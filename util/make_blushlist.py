#!/usr/bin/python
# Create blushlist.js from a list a domain names.
# Usage: make_blushlist.py <input_file> <category>

import sys
def main():
  if len(sys.argv) < 4:
    sys.exit("Usage: make_blushlist.py <output_file> {<input_file_i> "
             "<category_i>}")

  f_out = open(sys.argv[1], "w")
  f_out.write("// This file is automatically generated by make_blushlist.py\n")
  f_out.write("let blushlist = {\n")
  i = 2

  # Process all of the files, one by one
  while i < len(sys.argv):
    try:
      f_in = open(sys.argv[i], "r")
    except IOError as e:
      sys.exit("Can't find file: %s" % e)
    category = sys.argv[i + 1]
    for l in f_in.readlines():
      l = l.strip().lower()
      f_out.write("  \"%s\" : \"%s\",\n" % (l, category))
    f_in.close()
    i += 2

  f_out.write("};\n")
  f_out.write("module.exports = blushlist;\n")

  f_out.close()  

if __name__ == "__main__":
  main()
