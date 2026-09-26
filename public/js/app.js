// Plexar Notes browser entry. For now it only fetches the folder tree from the server and
// logs it; the sidebar and editor come in later tasks.

async function loadTree() {
  const res = await fetch("/api/tree");
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

loadTree()
  .then((data) => {
    console.log(`Plexar Notes: open folder "${data.folder}" at ${data.root}`);
    console.log(data.tree);
  })
  .catch((err) => console.error("Plexar Notes: could not load the folder tree", err));
