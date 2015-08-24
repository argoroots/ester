#!/usr/bin/env python
import urllib
import sys
import re
import htmllib
import formatter

# useful-looking URLs from http://lcweb.loc.gov/z3950/agency/defns/ with
# asn.1 inside <pre>...</pre> blocks

URLs = [
#    ('diags', 'http://lcweb.loc.gov/z3950/agency/defns/diags.html'),
# diags appears in v3-2001 draft
    ('frag', 'http://lcweb.loc.gov/z3950/agency/defns/fragtax.html'),
    ('zsql', 'http://archive.dstc.edu.au/DDU/projects/Z3950/Z+SQL/Z+SQL_profile.html'), # XXX note: has free-floating pre blocks, will be skipped
    ('update_es_rev1', 'http://lcweb.loc.gov/z3950/agency/defns/update-es-rev1.html'),
    ('charset_1', 'http://lcweb.loc.gov/z3950/agency/defns/charold1.html'),
#    ('userinfo_1', 'http://lcweb.loc.gov/z3950/agency/defns/user-1.html'),
# also appears in drafts
    ('multiple_search_term_1', 'http://lcweb.loc.gov/z3950/agency/defns/term-1.html'),
    ('multiple_search_term_2', 'http://lcweb.loc.gov/z3950/agency/defns/term-2.html'),
    ('date_time', 'http://lcweb.loc.gov/z3950/agency/defns/date.html'),
    ('ins_qualifier', 'http://lcweb.loc.gov/z3950/agency/defns/insert-qualifier.html'),
    ('edit_replace_qual', 'http://lcweb.loc.gov/z3950/agency/defns/editreplace-qualifier.html'),
    ('auth_file_info', 'http://lcweb.loc.gov/z3950/agency/defns/authority-file-info.html'),
    ('charset_2', 'http://lcweb.loc.gov/z3950/agency/defns/charsets.html'),
    ('charset_3', 'http://lcweb.loc.gov/z3950/agency/defns/charneg-3.html'),
    ('negot_es_size', 'http://lcweb.loc.gov/z3950/agency/defns/essize.html')]

class MyParser (htmllib.HTMLParser):
    def __init__ (self, f):
        self.pre_list = []
        htmllib.HTMLParser.__init__ (self,f)
    def start_pre (self, attrs):
        self.save_bgn ()
        htmllib.HTMLParser.start_pre (self, attrs)
    def end_pre (self):
        text = self.save_end ()
        self.pre_list.append (text)
        htmllib.HTMLParser.end_pre (self)

def do_download (asn_name, url):
    obj = urllib.urlopen (url)
    f = formatter.NullFormatter ()
    p = MyParser (f)
    p.feed (obj.read ())
    p.close ()
    if len (p.pre_list) <> 1:
        print "bad data for", asn_name, url, map (lambda x: x[:100],
                                                  p.pre_list)
        return
    fil = file (asn_name + ".asn", "w")
    fil.write (p.pre_list[0])
    fil.close ()
    
    
if __name__ == '__main__':
    assert (0)
# XXX Note that many of these need to be edited for correct ASN.1 syntax.
# A couple of options:
# - 1) store a hash of the downloaded data and a list of regexp substitutions
#      to be applied.  If the hash changes, warn the user that the regexp
#      list may need to be re-evaluated.
# - 2) just check for existence of the .asn file before writing
# - 3) check for existence of the .asn file, and if it exists, for the
#      string XXX in it (since I've tried to mark all edits with XXX
# - 4) disable the functionality until it actually becomes important
#      to implement 1) or 2), having used it to produce the initial
#      *.asn files to hack up.
    for asn_name, url in URLs:
        do_download (asn_name, url)
