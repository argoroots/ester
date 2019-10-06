# -*- coding: utf-8 -*-

import json
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

        if v[0] == '(' and v[-1] == ')':
            v = v[1:-1]

        if v[0] == '[' and v[-1] == ']':
            v = v[1:-1]

        if key == 'publishing-date' and v[0].lower() == 'c' and len(v) == 5:
            v = v[1:]

        result.append(v)

    return result


def get_values(line):
    first, middle, rest = line.partition(' ')
    v_list = rest.split('$')
    v_dict = { 'key': first.zfill(3) }

    if len(v_list) > 1:
        for v in v_list[1:]:
            v_dict[v[0]] = v[1:]
    else:
        v_dict['a'] = rest

    return v_dict


def handler(event, context):
    if not event['queryStringParameters'] or not event['queryStringParameters']['q']:
        return {
            'statusCode': 400,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({ 'message': 'Bad Request' })
        }

    print event['queryStringParameters']['q']

    try:
        result = []

        conn = zoom.Connection('ester.ester.ee', 212)
        conn.databaseName = 'INNOPAC'
        conn.preferredRecordSyntax = 'USMARC'

        q = event['queryStringParameters']['q'].encode('utf-8').replace('https://www.ester.ee/record=', '').replace('*est', '')

        query = zoom.Query('PQF', '@or @attr 1=4 "%(st)s" @or @attr 1=7 "%(st)s" @attr 1=12 "%(st)s"' % {'st': q})
        records = conn.search(query)

        for record in records:
            r = {}

            for line in str(record).splitlines():
                fields = get_values(line)
                key = fields.get('key')

                if key == '700' and fields.get('a') and author_mapping.get(fields.get('e')):
                    r.setdefault(author_mapping.get(fields.get('e'), fields.get('e')), []).append(fields.get('a'))
                else:
                    for k, v in fields.iteritems():
                        if mapping.get(key + k):
                            r.setdefault(mapping.get(key + k), []).append(v)

            for k, v in r.iteritems():
                r[k] = list(set(clean_values(k, v)))

            result.append(r)

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
    except Exception, e:
        print e

        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({ 'message': str(e) })
        }
