# -*- coding: utf-8 -*-

import os
import datetime
import time
import logging
import json
from tornado.ioloop import IOLoop
from tornado.web import RequestHandler, Application, url
from operator import itemgetter
from PyZ3950 import zoom, zmarc




class JSONDateFix(json.JSONEncoder):
    """
    Formats json.dumps() datetime values to YYYY-MM-DD HH:MM:SS. Use it like json.dumps(mydata, cls=JSONDateFix)

    """
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return time.strftime('%Y-%m-%d %H:%M:%S', obj.timetuple())
        if not isinstance(obj, (basestring, bool)):
            return '%s' % obj
        return json.JSONEncoder.default(self, obj)




class ESTER():
    server = 'ester.ester.ee' #193.40.4.242
    port = 212
    database = 'INNOPAC'

    __raw = []
    __marc = []
    __human = []

    #http://www.loc.gov/marc/bibliographic
    __marcmapping = {
         20: {'a': 'isn'},
         22: {'a': 'isn'},
         41: {'a': 'language',
              'h': 'original-language'},
         72: {'a': 'udc'},
         80: {'a': 'udc'},
        100: {'a': 'author'},
        245: {'a': 'title',
              'b': 'subtitle',
              'p': 'subtitle',
              'n': 'number'},
        250: {'a': 'edition'},
        260: {'a': 'publishing-place',
              'b': 'publisher',
              'c': 'publishing-date'},
        300: {'a': 'pages',
              'c': 'dimensions'},
        440: {'a': 'series',
              'p': 'series',
              'n': 'series-number',
              'v': 'series-number'},
        500: {'a': 'notes'},
        501: {'a': 'notes'},
        502: {'a': 'notes'},
        504: {'a': 'notes'},
        505: {'a': 'notes'},
        520: {'a': 'notes'},
        525: {'a': 'notes'},
        530: {'a': 'notes'},
        650: {'a': 'tag'},
        655: {'a': 'tag'},
        710: {'a': 'publisher'},
        907: {'a': 'ester-id'},
    }

    __authormapping = {
        u'fotograaf':        'photographer',
        u'helilooja':        'composer',
        u'illustreerija':    'illustrator',
        u'järelsõna autor':  'epilogue-author',
        u'koostaja':         'compiler',
        u'kujundaja':        'designer',
        u'osatäitja':        'actor',
        u'produtsent':       'producer',
        u'režissöör':        'director',
        u'stsenarist':       'screenwriter',
        u'toimetaja':        'editor',
        u'tolkija':          'translator',
        u'tõlkija':          'translator',
    }


    def __init__(self, server=None, port=None, database=None):
        if server:
            self.server = server
        if port:
            self.port = port
        if database:
            self.database = database


    def __len__(self):
        return len(self.__raw)


    def search(self, query):
        self.__raw = []
        self.__marc = []
        self.__human = []

        try:
            ester_conn = zoom.Connection(self.server, self.port)
            ester_conn.databaseName = self.database
            ester_conn.preferredRecordSyntax = 'USMARC'
            ester_query = zoom.Query('PQF', '@or @attr 1=4 "%(st)s" @or @attr 1=7 "%(st)s" @attr 1=12 "%(st)s"' % {'st': query})
            ester_result = ester_conn.search(ester_query)

            logging.debug('Found %s results for "%s" in %s:%s/%s' % (len(ester_result), query, self.server, self.port, self.database))

            if len(ester_result) > 0:
                for r in ester_result:
                    self.__raw.append(r.data)

        except Exception, e:
            logging.error('e: %s q:%s' % (e, query))

        ester_conn.close()


    def raw(self):
        return self.__raw


    def marc(self):
        if self.__marc:
            return self.__marc

        for raw in self.__raw:
            item = {}
            for tag, tag_values in zmarc.MARC(raw, strict=0).fields.iteritems():
                for v in tag_values:
                    if type(v) is not tuple:
                        item = self.__add_to_dict(item, tag, v)
                    else:
                        if len(v) == 3:
                            value = {}
                            for i in v[2]:
                                if len(i) == 2:
                                    value = self.__add_to_dict(value, i[0], i[1])
                            item = self.__add_to_dict(item, tag, value)
                        else:
                            item = self.__add_to_dict(item, tag, v)
            self.__marc.append(item)

        logging.debug('Converted %s raw records to marc dictionary' % len(self.__raw))
        return self.__marc


    def marc2(self):
        if self.__marc:
            return self.__marc

        for raw in self.__raw:
            self.__marc.append(zmarc.MARC(raw, strict=0).fields)

        logging.debug('Converted %s raw records to marc dictionary' % len(self.__raw))
        return self.__marc


    def human(self):
        if self.__human:
            return self.__human

        for marc in self.marc():
            item = {}
            for tag, tag_values in marc.iteritems():
                if type(tag_values) is not list:
                    tag_values = [tag_values]
                for tag_value in tag_values:
                    if type(tag_value) is not dict:
                        tag_value = {'x': tag_value}
                    for attr, values in tag_value.iteritems():
                        if type(values) is not list:
                            values = [values]
                        for v in values:
                            if self.__marcmapping.get(tag, {}).get(attr):
                                item = self.__add_to_dict(item, self.__marcmapping.get(tag, {}).get(attr), v.decode('utf-8').strip(' /,;:'))
                            elif tag == 5:
                                try:
                                    item = self.__add_to_dict(item, 'ester-changed-date', datetime.datetime.strptime(self.__clean_str(v)[:14], '%Y%m%d%H%M%S'))
                                except Exception, e:
                                    pass
                            elif tag == 700:
                                if self.__clean_str(tag_value.get('e'), '.') in self.__authormapping.keys() + self.__authormapping.values():
                                    item = self.__add_to_dict(item, self.__authormapping.get(self.__clean_str(tag_value.get('e'), '.'), self.__clean_str(tag_value.get('e'), '.')), tag_value.get('a'))
            self.__human.append(item)

        logging.debug('Converted %s marc records to human dictionary' % len(self.__marc))
        return self.__human


    def __clean_str(self, str, stripstr=''):
        if str:
            return str.decode('utf-8').strip(' /,;:%s' % stripstr)


    def __add_to_dict(self, dictionary, key, value):
        if key in dictionary:
            if type(dictionary[key]) is not list:
                dictionary[key] = [dictionary[key]]
            if value not in dictionary[key]:
                dictionary[key].append(value)
        else:
            dictionary[key] = value

        return dictionary




class EsterSearch(RequestHandler):
    def json(self, dictionary, status_code=None, allow_origin='*'):
        if status_code:
            self.set_status(status_code)
        if allow_origin:
            self.add_header('Access-Control-Allow-Origin', allow_origin)
        self.add_header('Content-Type', 'application/json;charset=utf-8')
        self.write(json.dumps(dictionary, cls=JSONDateFix))


    def get(self):
        query = self.get_argument('query', default=0, strip=True)
        query = query.encode('utf-8').replace('http://tartu.ester.ee/record=', '').replace('http://tallinn.ester.ee/record=', '').replace('~S1*est', '')

        ester = ESTER()
        ester.search(query)

        self.json(ester.marc2())




app = Application([
    url(r'/', EsterSearch),
])
app.listen(os.environ.get('PORT', 3000))
IOLoop.current().start()
