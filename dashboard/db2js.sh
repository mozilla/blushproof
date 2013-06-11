#!/bin/bash

echo "var events = ["
for line in `echo "" | sqlite3 -cmd 'select eventTS,eventSTR from events;' events.sqlite`; do
  event=`echo $line | cut -d "|" -f 2`
  ts=`echo $line | cut -d "|" -f 1`
  echo "  { event: \"$event\", time: $ts },"
done
echo "];"
