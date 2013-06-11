#!/bin/bash

if [ $# -ne 1 ]; then
  echo "Usage: `basename ${0}` <path to events.sqlite>"
  exit $E_BADARGS
fi

EVENTS_SQLITE=${1}
if [ ! -f "$EVENTS_SQLITE" ]; then
  echo "Could not find events database at '$EVENTS_SQLITE'"
  exit $E_BADARGS
fi

echo "var events = ["
for line in `echo "" | sqlite3 -cmd 'select eventTS,eventSTR from events;' $EVENTS_SQLITE`; do
  event=`echo $line | cut -d "|" -f 2`
  ts=`echo $line | cut -d "|" -f 1`
  echo "  { event: \"$event\", time: $ts },"
done
echo "];"
