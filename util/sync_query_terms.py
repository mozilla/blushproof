#!/usr/bin/python
"""A class to collect the top N hits for a list of query terms."""
# Usage: sync_query_terms.py <input_file> <output_file>

import json
import pycurl
import sys
import tldextract
import urllib

import StringIO

class QuerySyncer:
  """A class to collect the top N hits for a list of query terms."""

  def __init__(self, apikey, max_count=5):
    self.api_key = apikey
    self.max_count = max_count

  def get_top_hits(self, search_term):
    """Searches for the given term and returns an array of TLD hits."""
    # A custom search URL. cx is a global search engine.
    search_url = ("https://www.googleapis.com/customsearch/v1?" +
            "cx=018149516584340204128:67tqllu_gne&key=%s&q=%s&alt=json" %
            (self.api_key, urllib.quote_plus(search_term)))
    buf = StringIO.StringIO()
    curl = pycurl.Curl()
    curl.setopt(curl.URL, search_url)
    curl.setopt(curl.WRITEFUNCTION, buf.write)
    curl.perform()
    curl.close()
    return self.parse_results(buf.getvalue())

  def parse_results(self, result_string):
    """Parses JSON search results and returns max_count TLD results."""
    result = json.loads(result_string)
    if "items" not in result:
      raise Exception("Didn't get meaningful results", result_string)
    urls = []
    count = 0
    for i in result["items"]:
      if (count == self.max_count):
        break
      if i["kind"] != "customsearch#result":
        raise Exception("Unexpected results", result_string)
      count += 1
      ext = tldextract.extract(i["link"])
      urls.append(".".join([ext.domain, ext.tld]))
    return urls

  def process_search_terms(self, input_file, output_file):
    """Reads file with search terms, writes output_file with search results."""
    f_out = open(output_file, "w")
    # Each line of the input contains an addon id
    try:
      f_in = open(input_file)
    except IOError as error:
      sys.exit("Can't find file: %s" % error)
    for line in f_in.readlines():
      search_term = line.strip()
      urls = self.get_top_hits(search_term)
      f_out.write("\n".join(urls))
      f_out.write("\n")
    f_in.close()
    f_out.close()


def main():
  """Run it."""
  if len(sys.argv) < 3:
    sys.exit("Usage: sync_query_terms.py <input_file> <output_file>")
  try:
    f_api = open(".apikey", "r")
  except IOError as error:
    sys.exit("Can't find apikey: %s" % error)
  apikey = f_api.readline().strip()
  syncer = QuerySyncer(apikey)
  syncer.process_search_terms(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
  main()
