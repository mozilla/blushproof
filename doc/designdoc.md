What is blushproof?
===================
Blushproof is a Firefox addon that makes local privacy features (such as private browsing mode or clearing private data) easier to use.

Why does blushproof exist?
=========================
The goal of blushproof is to reduce potential embarrassment.

How blushproof works
====================
Blushproof uses `nsIContentPolicy` to listen for top-level HTTP requests. We chose to hook in here because
`nsIContentPolicy` guarantees that we capture all HTTP requests, in the event that we later on want to intercept requests for iframes or other included content.

Blushproof operates on eTLD+1 rather than whole URLs. This has the advantages of being able to capture all subdomains of potentially embarrassing domains. It also has the disadvantage of not being able to distinguish parts of sites like `reddit.com` where many varieties of subreddits exist on different paths, and domains like `blogspot.com` that host user content on different subdomains.

Blushproof differentiates search queries from regular HTTP requests. If a URL looks like a search query, we extract the query terms from the URL and check those. The reason for treating search queries specially is that for many people, the search itself for potentially embarrassing topics needs to be in private mode.

Data that blushproof collects
=============================
Blushproof uses [Micropilot][1] to instrument and upload data. One measure of Blushproof's utility is how often people interact with the UI. Currently UI features exist to

1. If a site or search query matches the blushlist, offer to open the page in private browsing mode.
2. Add a site to the blushlist.
3. Forget about a site (i.e., delete history and cookies for that site).

We propose to collect metrics on each of these events in the following format
<pre>
event: {
  // One of "match-query", "match-site", "open-in-pb", "open in regular", "blush-this", "forget-this",
  // "remove-from-blushlist"
  name: string,
  // Time since epoch in seconds, to the nearest hour
  timestamp: uint_64
}
</pre>

In addition to this data, Micropilot records metadata such as Firefox version, `personid` which allows us to count active daily users, and extension ids.

Data that blushproof does not collect
=====================================
Any domain information or category information.

Privacy concerns
================
On installation, the privacy policy will be shown, including a description of data that's collected and an option to turn it off. Metrics will be uploaded to an AWS server. Individual user data will be deleted after 1 month. Aggregated data (e.g., volume of query matches over time) will be kept forever and used to refine Blushproof.

[1]: http://github.com/gregglind/micropilot
