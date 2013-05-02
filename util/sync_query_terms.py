#!/usr/bin/python
# Given a list of addon ids, return a verdict of bad or not for each id.
# Usage: baddons.py <input_file> <output_file>

import csv
import logging
import json
import pycurl
import re
import sys
import tldextract

import StringIO

class QuerySyncer:
  """A class to collect the top N hits for a list of query terms."""

  def __init__(self, apikey, max_count=5):
    self.APIKEY = apikey
    self.MAX_COUNT = max_count

  def get_top_hits(self, search_term):
    """Returns 1 if the addon_id is probably bad, 0 otherwise."""
    # A custom search URL. cx is a global search engine.
    search_url = ("https://www.googleapis.com/customsearch/v1?" +
            "cx=018149516584340204128:67tqllu_gne&key=%s&q=%s&alt=json" %
            (self.APIKEY, search_term))
    buf = StringIO.StringIO()
    c = pycurl.Curl()
    c.setopt(c.URL, search_url)
    c.setopt(c.WRITEFUNCTION, buf.write)
    c.perform()
    c.close()
    return self.parse_results(buf.getvalue())

  def parse_results(self, result_string):
    """Parses JSON search results and returns 1 if it's probably malware."""
    result = json.loads(result_string)
    if "items" not in result:
      raise Exception("Didn't get meaningful results", result_string)
    urls = []
    count = 0
    for i in result["items"]:
      if (count == self.MAX_COUNT):
        break
      if i["kind"] != "customsearch#result":
        raise Exception("Unexpected results", result_string)
      count += 1
      ext = tldextract.extract(i["link"])
      urls.append(".".join([ext.domain, ext.tld]))
    return urls

  def process_search_terms(self, input_file, output_file):
    """Reads addon_id and counts, writes output_file with verdict."""
    f_out = open(output_file, "w")
    # Each line of the input contains an addon id
    try:
      f_in = open(input_file)
    except IOError as e:
      sys.exit("Can't find file: %s" % e)
    for line in f_in.readlines():
      search_term = line.strip()
      urls = self.get_top_hits(search_term)
      f_out.write("\n".join(urls))
      f_out.write("\n")
    f_in.close()
    f_out.close()


def main():
  if len(sys.argv) < 3:
    sys.exit("Usage: sync_query_terms.py <input_file> <output_file>")
  try:
    f_api = open(".apikey", "r")
  except IOError as e:
    sys.exit("Can't find apikey: %s" % e)
  apikey = f_api.readline().strip()
  syncer = QuerySyncer(apikey)
  syncer.process_search_terms(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
  main()
