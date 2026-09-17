document.addEventListener('DOMContentLoaded', function () {

  var REGIONS = {
    stockholm: {
      center: [59.33, 18.03],
      zoom: 11,
      places: [
        { name: 'Hansta naturreservat', lat: 59.417, lon: 17.887, lightPollution: 'moderate' },
        { name: 'Kyrkhamn, Hässelby', lat: 59.371, lon: 17.775, lightPollution: 'low' },
        { name: 'Judarskogen, Bromma', lat: 59.339, lon: 17.939, lightPollution: 'moderate' },
        { name: 'Flatens naturreservat', lat: 59.246, lon: 18.083, lightPollution: 'low' },
        { name: 'Rågsveds friluftsområde', lat: 59.263, lon: 18.043, lightPollution: 'moderate' },
        { name: 'Skarpnäcks naturreservat', lat: 59.281, lon: 18.133, lightPollution: 'moderate' }
      ]
    },
    dalarna: {
      center: [60.17, 16.5],
      zoom: 10,
      places: [
        { name: 'Färnebofjärdens nationalpark', lat: 60.183, lon: 16.767, lightPollution: 'low' },
        { name: 'Tallåsen naturreservat', lat: 60.205, lon: 16.478, lightPollution: 'moderate' },
        { name: 'Folkärna', lat: 60.156, lon: 16.313, lightPollution: 'moderate' },
        { name: 'Brunnbäck', lat: 60.131, lon: 16.253, lightPollution: 'low' }
      ]
    }
  };

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

  function moonImpactDescription(illumination) {
    if (illumination < 10) return 'Nästan ingen månljus — optimalt för svaga stjärnor och Vintergatan.';
    if (illumination < 40) return 'Svagt månljus — stör knappt stjärnkikningen.';
    if (illumination < 70) return 'Måttligt månljus — kan dämpa de svagaste stjärnorna.';
    if (illumination < 90) return 'Starkt månljus — begränsar sikten av Vintergatan markant.';
    return 'Fullmåne — fungerar som naturlig ljusförorening.';
  }

  function bortleDescription(score) {
    if (score >= 81) return 'Vintergatan syns med detaljer, kanske mörka dammoln.';
    if (score >= 61) return 'Vintergatan syns tydligt över hela himlen.';
    if (score >= 41) return 'Vintergatan skymtar svagt nära horisonten.';
    if (score >= 21) return 'Karlavagnen och starka stjärnbilder syns, inget mer.';
    return 'Bara månen och de klaraste planeterna syns.';
  }

  function fetchAuroraKp() {
    return fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')
      .then(function (res) { return res.json(); })
      .then(function (rows) {
        var lastRow = rows[rows.length - 1];
        return lastRow.Kp;
      })
      .catch(function (err) {
        console.error('Kunde inte hämta norrsken-data', err);
        return 0;
      });
  }

  function fetchHourlyCloudCover(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon + '&hourly=cloud_cover&timezone=auto&forecast_days=1';
    return fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        return data.hourly.time.map(function (t, i) {
          return { hour: parseInt(t.slice(11, 13), 10), label: t.slice(11, 16), cloudCover: data.hourly.cloud_cover[i] };
        });
      });
  }

  function averageCloudCover(hourlyArr) {
    var startIndex = new Date().getHours();
    var slice = hourlyArr.slice(startIndex, startIndex + 6);
    if (!slice.length) slice = hourlyArr.slice(-3);
    var sum = slice.reduce(function (a, h) { return a + h.cloudCover; }, 0);
    return Math.round(sum / slice.length);
  }

  function lerp(a, b, t) {
    return a.map(function (v, i) { return v + (b[i] - v) * t; });
  }

  function skyColor(hour, cloudCover) {
    var day = [110, 140, 165], dusk = [55, 68, 92], night = [12, 15, 24];
    var tone;
    if (hour >= 19 || hour < 4) tone = 1;
    else if (hour >= 16) tone = (hour - 16) / 3;
    else tone = 0;
    var base = tone < 0.5 ? lerp(day, dusk, tone * 2) : lerp(dusk, night, (tone - 0.5) * 2);
    var fog = cloudCover / 100;
    var gray = 130;
    var rgb = base.map(function (v) { return Math.round(v * (1 - fog * 0.6) + gray * fog * 0.6); });
    return 'rgb(' + rgb.join(',') + ')';
  }

  function formatTime(date) {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
  }

  function fetchDarkestWindow(lat, lon) {
    var today = new Date();
    var tomorrow = new Date(today.getTime() + 86400000);
    function toDateStr(d) { return d.toISOString().slice(0, 10); }
    var url1 = 'https://api.sunrise-sunset.org/json?lat=' + lat + '&lng=' + lon + '&date=' + toDateStr(today) + '&formatted=0';
    var url2 = 'https://api.sunrise-sunset.org/json?lat=' + lat + '&lng=' + lon + '&date=' + toDateStr(tomorrow) + '&formatted=0';
    return Promise.all([
      fetch(url1).then(function (r) { return r.json(); }),
      fetch(url2).then(function (r) { return r.json(); })
    ]).then(function (results) {
      var end = results[0].results.astronomical_twilight_end;
      var begin = results[1].results.astronomical_twilight_begin;
      if (!end || !begin) return null;
      return { start: new Date(end), end: new Date(begin) };
    }).catch(function (err) {
      console.error('Kunde inte hämta mörkaste tiden', err);
      return null;
    });
  }

  var map = L.map('stargazingMap');
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  var markersLayer = L.layerGroup().addTo(map);
  var currentRegionKey = 'stockholm';
  var selectedSpot = null;
  var sharedData = { moon: null, kp: 0, meteorShower: null, darkWindow: null };

  function categoryForScore(score) {
    if (score >= 70) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  function computeScore(cloudCover, lightPollution) {
    var penalty = POLLUTION_PENALTY[lightPollution] != null ? POLLUTION_PENALTY[lightPollution] : 15;
    var score = 100 - cloudCover * 0.6 - sharedData.moon.illumination * 0.3 - penalty;
    if (sharedData.kp >= 5) score += 10;
    if (sharedData.meteorShower) score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function renderDetailPanel(spot) {
    selectedSpot = spot;
    document.getElementById('detailPanel').hidden = false;
    document.getElementById('detailName').textContent = spot.name;
    document.getElementById('detailScore').textContent = (spot.score != null ? spot.score : '–') + '/100';
    document.getElementById('detailBortle').textContent = spot.score != null ? bortleDescription(spot.score) : 'Laddar…';
    document.getElementById('detailCloud').textContent = (spot.cloudCoverNow != null ? spot.cloudCoverNow : '–') + '%';

    var strip = document.getElementById('hourlyStrip');
    strip.innerHTML = '';
    if (spot.hourly) {
      var startIndex = new Date().getHours();
      spot.hourly.slice(startIndex, startIndex + 6).forEach(function (h) {
        var card = document.createElement('div');
        card.className = 'hour-card';
        card.style.background = skyColor(h.hour, h.cloudCover);
        card.innerHTML = '<div class="hour-time">' + h.label + '</div><div class="hour-clear">' + (100 - h.cloudCover) + '%</div>';
        strip.appendChild(card);
      });
    }
  }

  function loadSpot(spot, marker) {
    fetchHourlyCloudCover(spot.lat, spot.lon).then(function (hourly) {
      spot.hourly = hourly;
      spot.cloudCoverNow = averageCloudCover(hourly);
      spot.score = computeScore(spot.cloudCoverNow, spot.lightPollution);
      var category = categoryForScore(spot.score);
      marker.setStyle({ fillColor: COLORS[category] });
      if (selectedSpot === spot) renderDetailPanel(spot);
    }).catch(function (err) {
      console.error('Kunde inte hämta väder för ' + spot.name, err);
    });
  }

  function loadTonight(lat, lon) {
    var now = new Date();
    sharedData.moon = getMoonPhase(now);
    sharedData.meteorShower = getActiveMeteorShower(now);

    document.getElementById('tonightMoon').textContent = sharedData.moon.phase + ' (' + sharedData.moon.illumination + '% lit)';
    document.getElementById('tonightMoonImpact').textContent = moonImpactDescription(sharedData.moon.illumination);
    document.getElementById('tonightMeteor').textContent = sharedData.meteorShower ? sharedData.meteorShower + ' aktivt' : 'Inget aktivt ikväll';

    fetchAuroraKp().then(function (kp) {
      sharedData.kp = kp;
      document.getElementById('tonightAurora').textContent = 'Kp ' + kp + (kp >= 5 ? ' — norrsken möjligt' : ' — låg aktivitet');
    });

    fetchDarkestWindow(lat, lon).then(function (win) {
      sharedData.darkWindow = win;
      document.getElementById('tonightDark').textContent = win
        ? (formatTime(win.start) + '–' + formatTime(win.end))
        : 'Ingen fullständig mörker (ljus natt)';
    });
  }

  function loadRegion(key) {
    currentRegionKey = key;
    markersLayer.clearLayers();
    document.getElementById('detailPanel').hidden = true;
    selectedSpot = null;

    var region = REGIONS[key];
    map.setView(region.center, region.zoom);

    document.querySelectorAll('.region-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-region') === key);
    });

    region.places.forEach(function (spot) {
      var marker = L.circleMarker([spot.lat, spot.lon], {
        radius: 9,
        color: '#0d0f14',
        weight: 1,
        fillColor: '#7c7a72',
        fillOpacity: 0.9
      }).addTo(markersLayer);

      marker.on('mouseover', function () { marker.setRadius(13); });
      marker.on('mouseout', function () { marker.setRadius(9); });
      marker.on('click', function () {
        map.flyTo([spot.lat, spot.lon], Math.max(region.zoom, 12), { duration: 0.6 });
        renderDetailPanel(spot);
      });

      loadSpot(spot, marker);
    });

    loadTonight(region.center[0], region.center[1]);
  }

  function answerQuestion(question) {
    var q = question.toLowerCase();
    var currentPlaces = REGIONS[currentRegionKey].places;

    if (q.indexOf('mörk') !== -1) {
      return sharedData.darkWindow
        ? 'Det blir som mörkast mellan ' + formatTime(sharedData.darkWindow.start) + ' och ' + formatTime(sharedData.darkWindow.end) + ' ikväll.'
        : 'Det blir inte helt mörkt just nu (ljus natt).';
    }
    if (q.indexOf('norrsken') !== -1 || q.indexOf('aurora') !== -1) {
      return 'Kp-index just nu är ' + sharedData.kp + (sharedData.kp >= 5 ? ', så norrsken kan vara möjligt.' : ', vilket är låg aktivitet.');
    }
    if (q.indexOf('mån') !== -1) {
      return 'Månen är i fas "' + sharedData.moon.phase + '" och lyser ' + sharedData.moon.illumination + '%. ' + moonImpactDescription(sharedData.moon.illumination);
    }
    if (q.indexOf('meteor') !== -1 || q.indexOf('stjärnfall') !== -1) {
      return sharedData.meteorShower ? sharedData.meteorShower + ' är aktivt just nu.' : 'Inget meteorregn är aktivt just nu.';
    }
    if (q.indexOf('bäst') !== -1) {
      var scored = currentPlaces.filter(function (p) { return p.score != null; });
      if (!scored.length) return 'Data laddas fortfarande, försök om en liten stund.';
      var best = scored.reduce(function (a, b) { return b.score > a.score ? b : a; });
      return best.name + ' har just nu högst poäng (' + best.score + '/100).';
    }
    var matched = currentPlaces.filter(function (p) {
      return q.indexOf(p.name.toLowerCase().split(',')[0]) !== -1;
    })[0];
    if (matched) {
      return matched.score != null
        ? matched.name + ': ' + matched.score + '/100, ' + matched.cloudCoverNow + '% molntäcke.'
        : matched.name + ': data laddas fortfarande.';
    }
    if (q.indexOf('moln') !== -1) {
      return 'Säg gärna vilken plats du undrar över, t.ex. "hur mycket moln är det i Judarskogen?".';
    }
    return 'Jag förstod inte riktigt frågan. Prova att fråga om moln, måne, norrsken, mörkaste tiden, bästa platsen, eller en specifik plats.';
  }

  document.querySelectorAll('.region-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { loadRegion(btn.getAttribute('data-region')); });
  });

  document.getElementById('askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('askInput');
    var question = input.value.trim();
    if (!question) return;
    document.getElementById('askAnswer').textContent = answerQuestion(question);
  });

  loadRegion('stockholm');
});