import './style.css';
import {Map, View} from 'ol';
import {
  Fill,
  Stroke,
  Style,
} from 'ol/style';
import Select from 'ol/interaction/Select';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/src/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {click} from 'ol/events/condition';

/**********************/
/* Map Initialization */
/**********************/
const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    new VectorLayer({
      source: new VectorSource({
        url: 'data/pennsylvania-senatorial-districts.geojson',
        format: new GeoJSON(),
      }),
      style: function(feature) {
        let color = 'rgba(0, 255, 0, 0.3)';
        if (feature.values_.party === 'D') {
          color = 'rgba(0, 0, 255, 0.3)';
        } else if (feature.values_.party === 'R') {
          color = 'rgba(255, 0, 0, 0.3)';
        } else {
          color = 'rgba(96, 96, 96, 0.3)';
        }
        return new Style({
          stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.4)',
            width: 2,
          }),
          fill: new Fill({
            color,
          }),
        });
      },
    }),
  ],
  view: new View({
    center: fromLonLat([-77.594527, 40.953323]),
    zoom: 0,
    extent: [-10037783.233984917, 4776024.6675763335, -7237783.233984917, 5246024.6675763335],
  })
});

/********************/
/* Helper Functions */
/********************/

const compactPartyName = function (party) {
  switch (party) {
    case 'Democratic':
      return 'D';
    case 'Republican':
      return 'R';
    default:
      return party;
  }
};

/****************/
/* Senator Data */
/****************/
class Senator
{
  constructor(data)
  {
    this.election = data.election
    this.district = data.district
    this.party = data.party
    this.name = data.name
    this.votes = data.votes
    this.elected = data.elected
    this.note = data.note
  }
}

async function boot() {
  let senatorDistricts = {};
  await fetch("data/state-senators.json").then(async function(response) {
    const data = await response.json();
    const districts = data.reduce((previousValue, currentValue) => {
      if (!previousValue[currentValue.district]) {
        previousValue[currentValue.district] = [];
      }
      previousValue[currentValue.district].push(new Senator(currentValue));
      return previousValue;
    }, {});
    senatorDistricts = districts;
  });

  /*******************/
  /* Map Interaction */
  /*******************/

  const select = new Select({
    condition: click,
    style: function(feature) {
      let color = 'rgba(100, 255, 100, 0.3)';
      if (feature.values_.party === 'D') {
        color = 'rgba(100, 100, 255, 0.3)';
      } else if (feature.values_.party === 'R') {
        color = 'rgba(255, 100, 100, 0.3)';
      } else {
        color = 'rgba(164, 164, 164, 0.3)';
      }
      return new Style({
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 1)',
          width: 3,
        }),
        fill: new Fill({
          color,
        }),
      });
    },
  });

  select.on('select', function (e) {
    if (e.selected.length < 1) {
      document.getElementById('info-election-results-percentage-bar-democrat').style.display = 'none';
      document.getElementById('info-election-results-percentage-bar-republican').style.display = 'none';
      document.getElementById('info-election-results-percentage-bar-other').style.display = 'none';

      document.getElementById('district-info').hidden = true;
      document.getElementById('district-info-empty').hidden = false;
      return;
    }
    
    document.getElementById('district-info').hidden = false;
    document.getElementById('district-info-empty').hidden = true;

    const candidates = senatorDistricts[e.selected[0].values_.leg_distri];

    const senator = candidates.find(candidate => candidate.elected);

    document.getElementById('info-name').innerText = senator.name;
    document.getElementById('info-representative-link').href = e.selected[0].values_.url;
    document.getElementById('info-district').innerText = 'Senate District ' + e.selected[0].values_.leg_distri;

    switch(senator.party) {
      case 'Democratic':
        document.getElementById('info-democrat').style.display = 'flex';
        document.getElementById('info-republican').style.display = 'none';
        document.getElementById('info-independent').style.display = 'none';
        break;
      case 'Republican':
        document.getElementById('info-democrat').style.display = 'none';
        document.getElementById('info-republican').style.display = 'flex';
        document.getElementById('info-independent').style.display = 'none';
        break;
      default:
        document.getElementById('info-democrat').style.display = 'none';
        document.getElementById('info-republican').style.display = 'none';
        document.getElementById('info-independent').style.display = 'flex';
    }

    const totalVotes = candidates.reduce((previousValue, currentValue) => {
      return previousValue + currentValue.votes;
    }, 0);
    const partyVotes = candidates.reduce((previousValue, currentValue) => {
      switch (currentValue.party) {
        case 'Democratic':
          previousValue.Democratic += currentValue.votes;
          break;
        case 'Republican':
          previousValue.Republican += currentValue.votes;
          break;
        default:
          previousValue.Other += currentValue.votes;
          break;
      }
      return previousValue;
    }, {
      Democratic: 0,
      Republican: 0,
      Other: 0,
    });

    let voteTotalsDescription = '';
    if (senator.votes === totalVotes) {
      voteTotalsDescription = senator.name + ' (' + compactPartyName(senator.party) + ') ran uncontested in the ' + senator.election.substring(0, 4) + ' election, receiving ' + senator.votes.toLocaleString() + ' votes.';
    } else {
      voteTotalsDescription = 'In the ' + senator.election.substring(0, 4) + ' election, ' + senator.name + ' (' + compactPartyName(senator.party) + ') won with ' + senator.votes.toLocaleString() + ' votes out of ' + totalVotes.toLocaleString() + ' votes.';
      candidates.sort((a, b) => b.votes - a.votes).forEach(candidate => {
        if (candidate.name ===  senator.name) return;
        voteTotalsDescription += '\n' + candidate.name + ' (' + compactPartyName(candidate.party) + ') won ' + candidate.votes.toLocaleString() + ' votes.';
      });
    }
    if (senator.note) {
      voteTotalsDescription += '\n\n*' + senator.note;
    }
    document.getElementById('info-election-results-vote-totals').innerText = voteTotalsDescription;

    document.getElementById('info-election-results-percentage-bar-democrat').style.width = (partyVotes.Democratic / totalVotes * 100) + '%';
    document.getElementById('info-election-results-percentage-bar-republican').style.width = (partyVotes.Republican / totalVotes * 100) + '%';
    document.getElementById('info-election-results-percentage-bar-other').style.width = (partyVotes.Other / totalVotes * 100) + '%';

    document.getElementById('info-election-results-percentage-bar-democrat').style.display = partyVotes.Democratic < 1 ? 'none' : 'block';
    document.getElementById('info-election-results-percentage-bar-republican').style.display = partyVotes.Republican < 1 ? 'none' : 'block';
    document.getElementById('info-election-results-percentage-bar-other').style.display = partyVotes.Other < 1 ? 'none' : 'block';
  });

  map.addInteraction(select);

  /*******************/
  /* Senate Overview */
  /*******************/

  Object.keys(senatorDistricts).forEach(district => {
    const seatsList = document.getElementById('senate-info_seats');
    const seat = document.createElement('li');
    seat.className = 'block w-4 h-4 md:w-5 md:h-5 rounded-full';
    switch (senatorDistricts[district].find(candidate => candidate.elected).party) {
      case 'Democratic':
        seat.classList.add('bg-democrat');
        break;
      case 'Republican':
        seat.classList.add('bg-republican');
        break;
      default:
        seat.classList.add('bg-other');
    }
    seatsList.appendChild(seat);
  });
}

boot();
