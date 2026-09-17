document.addEventListener('DOMContentLoaded', function () {
  var SPOTS = [
    { name: 'Hansta naturreservat', lat: 59.417, lon: 17.887, lightPollution: 'moderate' },
    { name: 'Kyrkhamn, Hässelby', lat: 59.371, lon: 17.775, lightPollution: 'low' },
    { name: 'Judarskogen, Bromma', lat: 59.339, lon: 17.939, lightPollution: 'moderate' },
    { name: 'Flatens naturreservat', lat: 59.246, lon: 18.083, lightPollution: 'low' },
    { name: 'Rågsveds friluftsområde', lat: 59.263, lon: 18.043, lightPollution: 'moderate' },
    { name: 'Skarpnäcks naturreservat', lat: 59.281, lon: 18.133, lightPollution: 'moderate' }
  ];

  // Meteorregn upprepas samma kalenderdatum varje år, så det finns inget
  // bra live-API för dem — en egen tabell räcker gott.
  var METEOR_SHOWERS = [
    { name: 'Quadrantids', start: [1, 1], end: [1, 5] },
    { name: 'Lyrids', start: [4, 16], end: [4, 25] },
    { name: 'Eta Aquariids', start: [4, 19], end: [5, 28] },
    { name: 'Perseids', start: [7, 17], end: [8, 24] },
    { name: 'Orionids', start: [10, 2], end: [11, 7] },
    { name: 'Leonids', start: [11, 6], end: [11, 30] },
    { name: 'Geminids', start: [12, 4], end: [12, 17] },
    { name: 'Ursids', start: [12, 17], end: [12, 26] }
  ];

  var COLORS = { good: '#4caf50', fair: '#e8a33d', poor: '#d1533d' };
  var POLLUTION_PENALTY = { low: 0, moderate: 15, high: 30 };
  var POLLUTION_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High' };

  function getActiveMeteorShower(now) {
    var year = now.getFullYear();
    var found = null;
    METEOR_SHOWERS.forEach(function (shower) {
      var start = new Date(year, shower.start[0] - 1, shower.start[1]);
      var end = new Date(year, shower.end[0] - 1, shower.end[1], 23, 59, 59);
      if (now >= start && now <= end) found = shower.name;
    });
    return found;
  }

  // farmsense.net (tidigare källa för månfas) svarar inte längre — API:et
  // verkar ha lagts ner. Månfasen räknas därför ut lokalt med en känd
  // astronomisk formel istället för att fråga en extern tjänst.
  function getMoonPhase(date) {
    var knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
    var synodicMonth = 29.53058867;
    var diffDays = (date.getTime() - knownNewMoon.getTime()) / 86400000;
    var phaseIndex = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
    var illumination = (1 - Math.cos((phaseIndex / synodicMonth) * 2 * Math.PI)) / 2;
    var phaseName;
    if (phaseIndex < 1.84566) phaseName = 'New Moon';
    else if (phaseIndex < 5.53699) phaseName = 'Waxing Crescent';
    else if (phaseIndex < 9.22831) phaseName = 'First Quarter';
    else if (phaseIndex < 12.91963) phaseName = 'Waxing Gibbous';
    else if (phaseIndex < 16.61096) phaseName = 'Full Moon';
    else if (phaseIndex < 20.30228) phaseName = 'Waning Gibbous';
    else if (phaseIndex < 23.99361) phaseName = 'Last Quarter';
    else if (phaseIndex < 27.68493) phaseName = 'Waning Crescent';
    else phaseName = 'New Moon';
    return { phase: phaseName, illumination: Math.round(illumination * 100) };
  }

  function fetchAuroraKp() {
    return fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')
      .then(function (res) { return res.json(); })
      .then(function (rows) {
        var lastRow = rows[rows.length - 1];
        return parseFloat(lastRow[1]);
      })
      .catch(function (err) {
        console.error('Kunde inte hämta norrsken-data', err);
        return 0;
      });
  }

  // Open-Meteos dygnsdata börjar på timme 00:00 lokal tid, så dagens
  // timme (0–23) kan användas direkt som index i arrayen.
  function fetchCloudCover(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon + '&hourly=cloud_cover&timezone=auto&forecast_days=1';
    return fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var clouds = data.hourly.cloud_cover;
        var startIndex = new Date().getHours();
        var slice = clouds.slice(startIndex, startIndex + 6);
        if (!slice.length) slice = clouds.slice(-3);
        var avg = slice.reduce(function (a, b) { return a + b; }, 0) / slice.length;
        return Math.round(avg);
      });
  }

  function computeScore(opts) {
    var penalty = POLLUTION_PENALTY[opts.lightPollution] != null ? POLLUTION_PENALTY[opts.lightPollution] : 15;
    var score = 100 - opts.cloudCover * 0.6 - opts.moonIllumination * 0.3 - penalty;
    if (opts.kp >= 5) score += 10;
    if (opts.meteorActive) score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function categoryForScore(score) {
    if (score >= 70) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  function popupHtml(spot, score, cloudCover) {
    return '<div class="stargazing-popup">' +
      '<h4>' + spot.name + '</h4>' +
      '<span class="score">' + score + '/100</span>' +
      '<dl>' +
      '<dt>Cloud cover</dt><dd>' + cloudCover + '%</dd>' +
      '<dt>Light pollution</dt><dd>' + POLLUTION_LABEL[spot.lightPollution] + '</dd>' +
      '</dl></div>';
  }

  var map = L.map('stargazingMap').setView([59.33, 18.03], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  var markers = SPOTS.map(function (spot) {
    var marker = L.circleMarker([spot.lat, spot.lon], {
      radius: 10,
      color: '#18130f',
      weight: 1,
      fillColor: '#7c7a72',
      fillOpacity: 0.9
    }).addTo(map);
    marker.bindPopup('<div class="stargazing-popup"><h4>' + spot.name + '</h4><p>Loading…</p></div>');
    return { spot: spot, marker: marker };
  });

  var now = new Date();
  var activeMeteorShower = getActiveMeteorShower(now);
  document.getElementById('tonightMeteor').textContent = activeMeteorShower ? activeMeteorShower + ' active' : 'None active tonight';

  var moon = getMoonPhase(now);
  document.getElementById('tonightMoon').textContent = moon.phase + ' (' + moon.illumination + '% lit)';

  fetchAuroraKp().then(function (kp) {
    document.getElementById('tonightAurora').textContent = 'Kp ' + kp + (kp >= 5 ? ' — possible aurora' : ' — low activity');

    markers.forEach(function (item) {
      fetchCloudCover(item.spot.lat, item.spot.lon)
        .then(function (cloudCover) {
          var score = computeScore({
            cloudCover: cloudCover,
            moonIllumination: moon.illumination,
            kp: kp,
            lightPollution: item.spot.lightPollution,
            meteorActive: !!activeMeteorShower
          });
          var category = categoryForScore(score);
          item.marker.setStyle({ fillColor: COLORS[category] });
          item.marker.setPopupContent(popupHtml(item.spot, score, cloudCover));
        })
        .catch(function (err) {
          console.error('Kunde inte hämta väder för ' + item.spot.name, err);
          item.marker.setPopupContent('<div class="stargazing-popup"><h4>' + item.spot.name + '</h4><p>Could not load weather data.</p></div>');
        });
    });
  });
});