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
  var OVERVIEW_HOURS = [18, 19, 20, 21, 22, 23];

  function getActiveMeteorShower(date) {
    var year = date.getFullYear();
    var found = null;
    METEOR_SHOWERS.forEach(function (shower) {
      var start = new Date(year, shower.start[0] - 1, shower.start[1]);
      var end = new Date(year, shower.end[0] - 1, shower.end[1], 23, 59, 59);
      if (date >= start && date <= end) found = shower.name;
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
    if (illumination < 10) return 'Almost no moonlight — ideal for faint stars and the Milky Way.';
    if (illumination < 40) return 'Faint moonlight — barely affects stargazing.';
    if (illumination < 70) return 'Moderate moonlight — can dim the faintest stars.';
    if (illumination < 90) return 'Strong moonlight — significantly limits visibility of the Milky Way.';
    return 'Full moon — acts like natural light pollution.';
  }

  function bortleDescription(score) {
    if (score >= 81) return 'The Milky Way is visible with detail, maybe even dark dust lanes.';
    if (score >= 61) return 'The Milky Way is clearly visible across the sky.';
    if (score >= 41) return 'The Milky Way is faintly visible near the horizon.';
    if (score >= 21) return 'The Big Dipper and bright constellations are visible, nothing more.';
    return 'Only the Moon and the brightest planets are visible.';
  }

  function fetchAuroraKp() {
    return fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')
      .then(function (res) { return res.json(); })
      .then(function (rows) {
        var lastRow = rows[rows.length - 1];
        return lastRow.Kp;
      })
      .catch(function (err) {
        console.error('Could not fetch aurora data', err);
        return 0;
      });
  }

  function fetchWeekCloudCover(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon + '&hourly=cloud_cover&timezone=auto&forecast_days=7';
    return fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var days = {};
        var order = [];
        data.hourly.time.forEach(function (t, i) {
          var dateStr = t.slice(0, 10);
          if (!days[dateStr]) { days[dateStr] = []; order.push(dateStr); }
          days[dateStr].push({ hour: parseInt(t.slice(11, 13), 10), label: t.slice(11, 16), cloudCover: data.hourly.cloud_cover[i] });
        });
        return order.map(function (dateStr) { return { dateStr: dateStr, hours: days[dateStr] }; });
      });
  }

  function eveningHours(hours) {
    var evening = hours.filter(function (h) { return h.hour >= 18 && h.hour <= 23; });
    return evening.length ? evening : hours;
  }

  function averageCloudCover(hours) {
    var sum = hours.reduce(function (a, h) { return a + h.cloudCover; }, 0);
    return Math.round(sum / hours.length);
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
      console.error('Could not fetch darkest time', err);
      return null;
    });
  }

  function categoryForScore(score) {
    if (score >= 70) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  function computeScoreForDay(cloudCover, moonIllumination, lightPollution, meteorActive, kp) {
    var penalty = POLLUTION_PENALTY[lightPollution] != null ? POLLUTION_PENALTY[lightPollution] : 15;
    var score = 100 - cloudCover * 0.6 - moonIllumination * 0.3 - penalty;
    if (kp >= 5) score += 10;
    if (meteorActive) score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  var map = L.map('stargazingMap');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  var markersLayer = L.layerGroup().addTo(map);
  var currentRegionKey = 'stockholm';
  var selectedSpot = null;
  var selectedDayIndex = 0;
  var overviewDayIndex = 0;
  var overviewHour = 21;
  var sharedData = { moon: null, kp: 0, meteorShower: null, darkWindow: null };

  function scoreForHour(spot, dayIndex, hour) {
    var day = spot.week[dayIndex];
    var hourData = day.hours.filter(function (h) { return h.hour === hour; })[0];
    var cloud = hourData ? hourData.cloudCover : day.cloud;
    var kp = dayIndex === 0 ? sharedData.kp : 0;
    return computeScoreForDay(cloud, day.moonIllumination, spot.lightPollution, day.meteorActive, kp);
  }

  function updateOverviewColors() {
    var region = REGIONS[currentRegionKey];
    region.places.forEach(function (spot) {
      if (!spot.week || !spot.marker) return;
      var score = scoreForHour(spot, overviewDayIndex, overviewHour);
      spot.marker.setStyle({ fillColor: COLORS[categoryForScore(score)] });
    });
  }

  function renderOverviewControls() {
    var dayContainer = document.getElementById('overviewDays');
    var hourContainer = document.getElementById('overviewHours');
    dayContainer.innerHTML = '';
    hourContainer.innerHTML = '';

    var today = new Date();
    for (var i = 0; i < 7; i++) {
      (function (i) {
        var d = new Date(today.getTime() + i * 86400000);
        var label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
        var btn = document.createElement('button');
        btn.className = 'pick-btn' + (i === overviewDayIndex ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', function () {
          overviewDayIndex = i;
          renderOverviewControls();
          updateOverviewColors();
        });
        dayContainer.appendChild(btn);
      })(i);
    }

    OVERVIEW_HOURS.forEach(function (h) {
      var btn = document.createElement('button');
      btn.className = 'pick-btn' + (h === overviewHour ? ' active' : '');
      btn.textContent = h + ':00';
      btn.addEventListener('click', function () {
        overviewHour = h;
        renderOverviewControls();
        updateOverviewColors();
      });
      hourContainer.appendChild(btn);
    });
  }

  function renderDayOutlook(spot) {
    var container = document.getElementById('dayOutlook');
    container.innerHTML = '';
    spot.week.forEach(function (day, i) {
      var btn = document.createElement('button');
      btn.className = 'pick-btn' + (i === selectedDayIndex ? ' active' : '');
      var d = new Date(day.dateStr + 'T12:00:00');
      var label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      btn.innerHTML = label + '<span class="pick-btn__score">' + day.score + '</span>';
      btn.addEventListener('click', function () {
        selectedDayIndex = i;
        renderDetailPanel(spot);
      });
      container.appendChild(btn);
    });
  }

  function renderDetailPanel(spot) {
    selectedSpot = spot;
    document.getElementById('detailPanel').hidden = false;
    document.getElementById('detailName').textContent = spot.name;

    if (!spot.week) {
      document.getElementById('detailScore').textContent = '–';
      document.getElementById('detailBortle').textContent = 'Loading…';
      document.getElementById('detailCloud').textContent = '–';
      document.getElementById('dayOutlook').innerHTML = '';
      document.getElementById('hourlyStrip').innerHTML = '';
      return;
    }

    var day = spot.week[selectedDayIndex];
    document.getElementById('detailScore').textContent = day.score + '/100';
    document.getElementById('detailBortle').textContent = bortleDescription(day.score);
    document.getElementById('detailCloud').textContent = day.cloud + '%';

    renderDayOutlook(spot);

    var strip = document.getElementById('hourlyStrip');
    strip.innerHTML = '';
    eveningHours(day.hours).forEach(function (h) {
      var card = document.createElement('div');
      card.className = 'hour-card';
      card.style.background = skyColor(h.hour, h.cloudCover);
      card.innerHTML = '<div class="hour-time">' + h.label + '</div><div class="hour-clear">' + (100 - h.cloudCover) + '%</div>';
      strip.appendChild(card);
    });
  }

  function loadSpot(spot, marker) {
    spot.marker = marker;
    fetchWeekCloudCover(spot.lat, spot.lon).then(function (weekRaw) {
      spot.week = weekRaw.map(function (day, i) {
        var evening = eveningHours(day.hours);
        var cloud = averageCloudCover(evening);
        var dayDate = new Date(day.dateStr + 'T20:00:00');
        var moon = getMoonPhase(dayDate);
        var meteor = getActiveMeteorShower(dayDate);
        var kp = i === 0 ? sharedData.kp : 0;
        var score = computeScoreForDay(cloud, moon.illumination, spot.lightPollution, !!meteor, kp);
        return { dateStr: day.dateStr, hours: day.hours, cloud: cloud, score: score, moonIllumination: moon.illumination, meteorActive: !!meteor };
      });
      updateOverviewColors();
      if (selectedSpot === spot) renderDetailPanel(spot);
    }).catch(function (err) {
      console.error('Could not fetch weather for ' + spot.name, err);
    });
  }

  function loadTonight(lat, lon) {
    var now = new Date();
    sharedData.moon = getMoonPhase(now);
    sharedData.meteorShower = getActiveMeteorShower(now);

    document.getElementById('tonightMoon').textContent = sharedData.moon.phase + ' (' + sharedData.moon.illumination + '% lit)';
    document.getElementById('tonightMoonImpact').textContent = moonImpactDescription(sharedData.moon.illumination);
    document.getElementById('tonightMeteor').textContent = sharedData.meteorShower ? sharedData.meteorShower + ' active' : 'None active tonight';

    fetchAuroraKp().then(function (kp) {
      sharedData.kp = kp;
      document.getElementById('tonightAurora').textContent = 'Kp ' + kp + (kp >= 5 ? ' — aurora possible' : ' — low activity');
      updateOverviewColors();
    });

    fetchDarkestWindow(lat, lon).then(function (win) {
      sharedData.darkWindow = win;
      document.getElementById('tonightDark').textContent = win
        ? (formatTime(win.start) + '–' + formatTime(win.end))
        : 'No full darkness tonight (bright night)';
    });
  }

  function loadRegion(key) {
    currentRegionKey = key;
    markersLayer.clearLayers();
    document.getElementById('detailPanel').hidden = true;
    selectedSpot = null;
    selectedDayIndex = 0;

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
        selectedDayIndex = 0;
        renderDetailPanel(spot);
      });

      loadSpot(spot, marker);
    });

    loadTonight(region.center[0], region.center[1]);
  }

  function answerQuestion(question) {
    var q = question.toLowerCase();
    var currentPlaces = REGIONS[currentRegionKey].places;

    if (q.indexOf('dark') !== -1) {
      return sharedData.darkWindow
        ? 'It will be darkest between ' + formatTime(sharedData.darkWindow.start) + ' and ' + formatTime(sharedData.darkWindow.end) + ' tonight.'
        : 'It won\'t get fully dark tonight (bright night).';
    }
    if (q.indexOf('aurora') !== -1) {
      return 'The Kp-index right now is ' + sharedData.kp + (sharedData.kp >= 5 ? ', so aurora may be visible.' : ', which is low activity.');
    }
    if (q.indexOf('moon') !== -1) {
      return 'The moon is in "' + sharedData.moon.phase + '" phase and ' + sharedData.moon.illumination + '% lit. ' + moonImpactDescription(sharedData.moon.illumination);
    }
    if (q.indexOf('meteor') !== -1) {
      return sharedData.meteorShower ? sharedData.meteorShower + ' is active right now.' : 'No meteor shower is active right now.';
    }
    if (q.indexOf('best') !== -1) {
      var scored = currentPlaces.filter(function (p) { return p.week; });
      if (!scored.length) return 'Data is still loading, try again in a moment.';
      var best = scored.reduce(function (a, b) { return b.week[0].score > a.week[0].score ? b : a; });
      return best.name + ' has the highest score right now (' + best.week[0].score + '/100).';
    }
    var matched = currentPlaces.filter(function (p) {
      return q.indexOf(p.name.toLowerCase().split(',')[0]) !== -1;
    })[0];
    if (matched) {
      return matched.week
        ? matched.name + ': ' + matched.week[0].score + '/100, ' + matched.week[0].cloud + '% cloud cover.'
        : matched.name + ': data still loading.';
    }
    if (q.indexOf('cloud') !== -1) {
      return 'Try naming a place, e.g. "how cloudy is it in Judarskogen?".';
    }
    return 'I didn\'t quite understand that. Try asking about clouds, the moon, aurora, the darkest time, the best spot, or a specific place.';
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

  renderOverviewControls();
  loadRegion('stockholm');
});