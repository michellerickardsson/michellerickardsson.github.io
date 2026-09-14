const token = "KGAT_80d7f7628e4143610610bd3e7a70c096";
const url = "https://www.kaggle.com/api/v1/datasets/download/rodsaldanha/arketing-campaign/marketing_campaign.csv";
async function main() {
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token }
  });
  console.log("Status:", response.status);
  const text = await response.text();
  const rows = text.trim().split("\n").slice(1);
  const accepted = rows.filter(row => row.trim().split(";").at(-1) === "1").length;
  console.log("Customers:", rows.length);
  console.log("Accepted the last campaign:", accepted);

  // Column positions for AcceptedCmp1..5, based on the header order
  // (AcceptedCmp3, AcceptedCmp4, AcceptedCmp5, AcceptedCmp1, AcceptedCmp2)
  const campaignColumns = {
    1: 23,
    2: 24,
    3: 20,
    4: 21,
    5: 22
  };
  for (let campaign = 1; campaign <= 5; campaign++) {
    const columnIndex = campaignColumns[campaign];
    const count = rows.filter(row => row.trim().split(";")[columnIndex] === "1").length;
    console.log(`Accepted campaign ${campaign}:`, count);
  }
}
main();
