// scraper.js
// Skrapar företagsobjekt (namn, org.nr, telefon, adress) från allabolag.se
// och sparar dem i foretag.csv

const fs = require('node:fs');
const cheerio = require('cheerio');

const URL = 'https://www.allabolag.se/bransch-s%C3%B6k?q=Arkitekter';

// Utan en "riktig" User-Agent svarar sidan med fel 403 (nekad åtkomst),
// så vi låtsas vara en vanlig Chrome-webbläsare.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Gör om ett textfält till en giltig CSV-cell: om texten innehåller
// komma, citattecken eller radbrytning måste den omges av citattecken,
// och eventuella citattecken i texten dubbleras.
function tillCsvFalt(text) {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

async function main() {
  console.log('Hämtar sidan...');

  const response = await fetch(URL, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Sidan svarade med felkod ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Varje företag ligger i ett "kort" med klassen SearchResultCard-card
  const kort = $('.SearchResultCard-card');

  if (kort.length === 0) {
    console.log('Hittade inga företagsobjekt. Sidans HTML-struktur kan ha ändrats.');
    return;
  }

  const rader = [];

  kort.each((i, element) => {
    const objekt = $(element);

    // Företagsnamn
    const namn = objekt.find('.addax-cs_hl_hit_company_name_click').first().text().trim();

    // Organisationsnummer: text bredvid byggnads-ikonen, efter etiketten "Org.nr"
    let orgnr = '';
    const orgnrElement = objekt.find('svg[data-icon="building"]').parent();
    if (orgnrElement.length > 0) {
      orgnr = orgnrElement.text().trim().replace(/^Org\.nr\s*/, '');
    }

    // Telefonnummer: text bredvid telefon-ikonen, efter etiketten "Telefon"
    let telefon = '';
    const telefonElement = objekt.find('svg[data-icon="phone-flip"]').parent();
    if (telefonElement.length > 0) {
      telefon = telefonElement.text().trim().replace(/^Telefon\s*/, '');
    }

    // Adress: text bredvid plats-ikonen (har ingen egen etikett)
    let adress = '';
    const adressElement = objekt.find('svg[data-icon="location-dot"]').parent();
    if (adressElement.length > 0) {
      adress = adressElement.text().trim();
    }

    rader.push([namn, orgnr, telefon, adress]);
  });

  // Bygg CSV-innehållet: rubrikrad + en rad per företag
  const rubrikrad = ['Foretagsnamn', 'Organisationsnummer', 'Telefonnummer', 'Adress'];
  const csvRader = [rubrikrad, ...rader].map((rad) => rad.map(tillCsvFalt).join(','));
  const csvInnehall = csvRader.join('\n');

  fs.writeFileSync('foretag.csv', csvInnehall, 'utf-8');

  console.log(`Klart! Sparade ${rader.length} företag i foretag.csv`);
}

main().catch((error) => {
  console.error('Något gick fel:', error.message);
});
