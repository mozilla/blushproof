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

Blushproof operates on eTLD+1 rather than whole URLs. This has the advantages of being able to capture all subdomains of potentially embarrassing domains. It also has the disadvantage of not being able to distinguish parts of sites like `reddit.com` where many varieties of subreddits exist, and domains like `blogspot.com` that host user content on different subdomains.

Blushproof differentiates search queries from regular HTTP requests. If a URL looks like a search query, we extract the query terms from the URL and check those. The reason for treating search queries specially is that for many people, the search itself for potentially embarrassing topics needs to be in private mode.

Data that blushproof collects
=============================
Blushproof uses [Micropilot][1] to instrument and upload data. One measure of Blushproof's utility is how often people interact with the UI. Currently UI features exist to

1. If a site or search query matches the blushlist, offer to open the page in private browsing mode.
2. Add a site to the blushlist.
3. Forget about a site (i.e., delete history and cookies for that site)

We propose to collect metrics on each of these events in the following format
<pre>
event: {
  // One of "match-query", "match-site", "open-in-pb", "open in regular", "add-blushlist"
  name: string,
</pre>

[1]: http://github.com/gregglind/micropilot
