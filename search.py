# -*- coding: utf-8 -*-


import json
import time

import pymarc
from PyZ3950 import zoom


mapping = { #http://www.loc.gov/marc/bibliographic
    '020a': 'isbn',
    '022a': 'issn',
    '041a': 'language',
    '041h': 'original-language',
    '072a': 'udc',
    '080a': 'udc',
    '100a': 'author',
    '245a': 'title',
    '245b': 'subtitle',
    '245p': 'subtitle',
    '245n': 'number',
    '250a': 'edition',
    '260a': 'publishing-place',
    '260b': 'publisher',
    '260c': 'publishing-date',
    '300a': 'pages',
    '300c': 'dimensions',
    '440a': 'series',
    '440p': 'series',
    '440n': 'series-number',
    '440v': 'series-number',
    '500a': 'notes',
    '501a': 'notes',
    '502a': 'notes',
    '504a': 'notes',
    '505a': 'notes',
    '520a': 'notes',
    '525a': 'notes',
    '530a': 'notes',
    '650a': 'tag',
    '655a': 'tag',
    '710a': 'publisher',
    '907a': 'ester-id'
}

SEARCH_ATTRIBUTES = (
    4,   # title
    7,   # ISBN
    12,  # local record number (ester-id)
)

# Each record is fetched separately (0.1-1 s each), so a broad query must be
# capped by count and by time to stay within the Lambda timeout.
MAX_RECORDS = 10
TIME_BUDGET = 12  # seconds; searches still running by then won't return anything useful
TIME_MARGIN = 2   # seconds left before the Lambda timeout for closing and responding

author_mapping = {
    'fotograaf':       'photographer',
    'helilooja':       'composer',
    'illustreerija':   'illustrator',
    'järelsõna autor': 'epilogue-author',
    'koostaja':        'compiler',
    'kujundaja':       'designer',
    'osatäitja':       'actor',
    'produtsent':      'producer',
    'režissöör':       'director',
    'stsenarist':      'screenwriter',
    'toimetaja':       'editor',
    'tolkija':         'translator',
    'tõlkija':         'translator',
}


def clean_values(key, values):
    result = []
    for v in values:
        v = v.strip(' /,;:')

        if not v:
            continue

        if v[0] == '(' and v[-1] == ')':
            v = v[1:-1]

        if v[0] == '[' and v[-1] == ']':
            v = v[1:-1]

        if key == 'publishing-date':
            v = v.strip('c.-')

        result.append(v)

    return result


def parse_record(record):
    data = record.data
    if isinstance(data, str):
        # PyZ3950 mis-decodes the raw MARC bytes as latin-1 on Python 3
        data = data.encode('latin-1')

    rec = pymarc.Record(data=data, to_unicode=True, force_utf8=True)
    r = {}

    for field in rec.get_fields():
        if field.is_control_field():
            continue

        subfields = [(sf.code, sf.value) for sf in field.subfields]

        if field.tag == '700':
            sf = dict(subfields)
            author_type = author_mapping.get(sf.get('e', '').strip(' /,;:'))
            if sf.get('a') and author_type:
                r.setdefault(author_type, []).append(sf['a'])
            continue

        for code, value in subfields:
            if mapping.get(field.tag + code):
                r.setdefault(mapping.get(field.tag + code), []).append(value)

    for k, v in r.items():
        r[k] = list(set(clean_values(k, v)))

    if r.get('ester-id'):
        r['ester-id'] = [id for id in r['ester-id'] if len(id) < 11 and (id.startswith('.b') or id.startswith('b'))]

    return r


def search(q, deadline):
    # Title, ISBN/ISSN and local record number are queried separately: ESTER's
    # server reports phantom hits for @or-combined queries that fail on fetch.
    conn = zoom.Connection('ester.ester.ee', 212)
    conn.databaseName = 'INNOPAC'
    conn.preferredRecordSyntax = 'USMARC'
    conn.presentChunk = MAX_RECORDS  # fetch only as many records as we return

    result = []
    seen = set()

    def set_timeout():
        # Bound every socket read by the remaining budget, so one slow search
        # (e.g. a very broad title query) can't run past the Lambda timeout.
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError
        conn._cli.sock.settimeout(remaining)

    try:
        for attr in SEARCH_ATTRIBUTES:
            set_timeout()
            records = conn.search(zoom.Query('PQF', '@attr 1=%d "%s"' % (attr, q)))

            for i in range(len(records)):
                if len(result) >= MAX_RECORDS:
                    return result, False

                set_timeout()
                try:
                    r = parse_record(records[i])
                except zoom.Bib1Err as e:
                    print('skipped record %d for 1=%d: %s' % (i, attr, e))
                    continue

                key = tuple(sorted(r.get('ester-id', [])))
                if key:
                    if key in seen:
                        continue
                    seen.add(key)

                result.append(r)
    except (TimeoutError, zoom.ConnectionError) as e:
        if time.monotonic() < deadline:
            raise
        print('time budget exhausted after %d records' % len(result))
        return result, True
    finally:
        try:
            conn.close()
        except Exception:
            pass

    return result, False


def response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
        'body': json.dumps(body)
    }


def handler(event, context):
    params = event.get('queryStringParameters') or {}

    if not params.get('q'):
        return response(400, { 'message': 'Bad Request' })

    print(params['q'])

    q = params['q'].replace('https://www.ester.ee/record=', '').replace('*est', '')
    q = q.replace('"', ' ').strip()

    if not q:
        return response(400, { 'message': 'Bad Request' })

    try:
        budget = TIME_BUDGET
        if context is not None and hasattr(context, 'get_remaining_time_in_millis'):
            budget = min(budget, context.get_remaining_time_in_millis() / 1000 - TIME_MARGIN)

        result, timed_out = search(q, time.monotonic() + budget)

        if timed_out and not result:
            return response(504, { 'message': 'ESTER search timed out' })

        return response(200, result)
    except Exception as e:
        print(e)

        return response(500, { 'message': str(e) })
