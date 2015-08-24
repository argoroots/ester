#!/usr/bin/env python

import random
import time

from PyZ3950 import zoom, ccl

from threading import Thread, currentThread
from Queue import Queue

thread_count = 10


class TestThread (Thread):
    def __init__ (self, terminate_queue, *args, **kw):
        Thread.__init__ (self, *args, **kw)
        self.terminate_queue = terminate_queue
        self.count = 0
        self.queries = [
            'any = wive and any = wealthily',
            'any = mandrake',]
        self.mylex = ccl.make_lexer ()
    def testlex (self, s):
        self.mylex.input (s)
        while 1:
            token = self.mylex.token ()
            if not token:
                break

    def run (self):
        while 1:
            self.count += 1
            query_str = random.choice (self.queries)
            try:
                q = self.testlex (query_str)
#                q = zoom.Query ('CCL', query_str)
            except zoom.QuerySyntaxError, e:
                print "e", e, "q", query_str

            if self.count > 500:
                # should randomly do clean vs. not clean exit
                self.terminate_queue.put (self, 1)
                break

if __name__ == '__main__':
    start_t = time.time()
    thread_list = []
    terminate_queue = Queue ()
    for i in range (thread_count):
        t = TestThread (terminate_queue)
        t.start ()
        thread_list.append (t)
    total_count = 0

    while len (thread_list) > 0:
        t = terminate_queue.get (1)
        t.join ()
        total_count += t.count
        thread_list.remove (t)
    
    end_t = time.time ()
    elapsed = end_t - start_t
    print "total", total_count, "elapsed", elapsed
    print "rate", total_count * 1.0 / elapsed
    
        
        
        
