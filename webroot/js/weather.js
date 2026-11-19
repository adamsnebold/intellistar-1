var weatherInfo = {
    specialModes: {
        precip: false,
        bulletin: false
    },
    bulletin: {
        enabled: false,
        alerts: [],
        crawlAlert: {
            enabled: false,
            alert: undefined
        }
    },
    currentConditions: {
        humidity: "",
        pressure: { trend: "", val: "" },
        wind: "",
        dewpoint: "",
        gusts: "",
        icon: "",
        cond: "",
        temp: "",
        visibility: "",
        feelslike: { type: "", val: "" },
        noReport: false
    },
    eightCities: {
        noReport: false,
        cities: []
    },
    dayDesc: {
        noReport: false,
        days: []
    },
    weekAhead: {
        noReport: false,
        days: []
    },
    almanac: {
        noReport: false,
        stationname: "",
        days: [],
        yesterday: { high: "", low: "" },
        average: { high: "", low: "" },
        record: { high: "", recordYearHigh: "", low: "", recordYearLow: "" },
        moonphases: []
    },
    airQuality: {
        category: "",
        categoryIndex: 0,
        pollutants: []
    },
    outdoorActivity: {
        noReport: false,
        time: "",
        temp: "",
        cond: "",
        icon: "",
        wind: "",
        bg: 1,
        feelslike: {type:undefined,val:""}
    },
    daypartForecast: {
        noReport: false,
        times: []
    },
    map: {
        days: [],
        mapCities: [
            //{current: {}, forecast: {}}
        ],
    },
    radarUnavailable: false,
    monthlyPrecip: "",
}

async function grabData() {
    $("#startbutton").css("opacity", "0.5");
    $("#startbutton").css("pointer-events", "none");
    weatherInfo.specialModes.bulletin = false;
    weatherInfo.specialModes.precip = false;
    var now = Date.now();
    await grabCC();
    await grabNearbyCC();
    await grabLocalForecast();
    grabMonthlyPrecip();
    await grabAirQuality();
    await grabAlmanac();
    await grabDaypartForecast();
    await grabOutdoorActivityData();
    await grabMapCityData();
    await grabAlerts();
    await grabRegionalForecast();
    console.log(`Weather grab done in ${Date.now() - now}ms`);
    console.log(weatherInfo);
    setTimeout(() => {
        slideFlavor = flavorPicker(slideSettings.flavor, {bulletin: weatherInfo.specialModes.bulletin, precip: weatherInfo.specialModes.precip});
        console.log(slideFlavor);
        setTimeout(() => {
            $("#startbutton").css("opacity", "");
            $("#startbutton").css("pointer-events", "");
        }, 100);
    }, 250);
}
async function grabCC() {
    $.getJSON("https://api.weather.com/v3/wx/observations/current?geocode=" + locationConfig.mainCity.lat + "," + locationConfig.mainCity.lon + "&units=e&language=en-US&format=json&apiKey=" + api_key, function (data) {
        weatherInfo.currentConditions.cond = data.wxPhraseLong.replace("Showers in the Vicinity", "Showers Nearby").replace("/Wind", ", Windy").replace("Thunder in the Vicinity", "Thunder");
        weatherInfo.currentConditions.gusts = ((data.windGust != null || data.windGust != undefined) ? data.windGust : "None");
        weatherInfo.currentConditions.humidity = data.relativeHumidity + "%";
        weatherInfo.currentConditions.icon = data.iconCodeExtend;
        weatherInfo.currentConditions.pressure.trend = data.pressureTendencyTrend;
        weatherInfo.currentConditions.pressure.val = data.pressureAltimeter.toFixed(2);
        weatherInfo.currentConditions.temp = data.temperature;
        weatherInfo.currentConditions.dewpoint = data.temperatureDewPoint;
        weatherInfo.currentConditions.wind = ((data.windDirectionCardinal == "CALM" || data.windSpeed == 0 || data.windDirectionCardinal == undefined) ? "Calm" : data.windDirectionCardinal + " " + data.windSpeed);
        weatherInfo.currentConditions.visibility = data.visibility;
        weatherInfo.currentConditions.noReport = false;

        if (data.temperatureHeatIndex > data.temperature + 3) {
            weatherInfo.currentConditions.feelslike.type = "Heat Index";
            weatherInfo.currentConditions.feelslike.val = data.temperatureHeatIndex;
        } else if (data.temperatureWindChill < data.temperature - 3) {
            weatherInfo.currentConditions.feelslike.type = "Wind Chill";
            weatherInfo.currentConditions.feelslike.val = data.temperatureWindChill;
        } else {
            weatherInfo.currentConditions.feelslike.type = null;
        }
    }).fail(function () {
        weatherInfo.currentConditions.noReport = true;
    })
}
async function grabNearbyCC() {
    if(locationConfig.eightCities.cities.length == 0){
        weatherInfo.eightCities.noReport = true;
        return;
    }
    weatherInfo.eightCities.noReport = false;
    weatherInfo.eightCities.cities = [];
    var url = "https://api.weather.com/v3/aggcommon/v3-wx-observations-current?geocodes="
    for (var l = 0; l < 8; l++) {
        if (locationConfig.eightCities.cities[l]) {
            url += locationConfig.eightCities.cities[l].lat + "," + locationConfig.eightCities.cities[l].lon + ";"
        }
    }
    url += "&language=en-US&units=e&format=json&apiKey=" + api_key;

    $.getJSON(url, function (data) {
        data.forEach((ajaxedLoc, i) => {
            var eightslideloc = { name: "", temp: "", icon: "", wind: "" }
            eightslideloc.name = locationConfig.eightCities.cities[i].displayname;
            eightslideloc.temp = ajaxedLoc["v3-wx-observations-current"].temperature;
            eightslideloc.icon = ajaxedLoc["v3-wx-observations-current"].iconCodeExtend;
            eightslideloc.wind = {
                direction: ajaxedLoc["v3-wx-observations-current"].windSpeed == 0 ? "Calm" : ajaxedLoc["v3-wx-observations-current"].windDirectionCardinal,
                speed: ajaxedLoc["v3-wx-observations-current"].windSpeed
            }
            weatherInfo.eightCities.cities.push(eightslideloc)
        })
    }).fail(function () {
        weatherInfo.eightCities.noReport = true;
        for (var i = 0; i < 8; i++) {
            var eightslideNR = { name: !(locationConfig.eightCities.cities[i].displayname) ? "" : locationConfig.eightCities.cities[i].displayname, temp: "", icon: 4400, wind: "", windspeed: "" }
            weatherInfo.eightCities.cities.push(eightslideNR)
        }
    })
}
// These API fields already contain the forecast location's wall-clock time
// and UTC offset. Parsing into Date and formatting without a zone incorrectly
// converts them to the viewer's computer zone. Keep the supplied local fields,
// including each day's own DST/half-hour offset. Polar/missing events stay blank.
function formatSolarTime(localISO) {
    if (typeof localISO !== 'string') return '—';
    const match = localISO.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2})?(?:[+-]\d{2}:?\d{2}|Z)$/);
    if (!match) return '—';
    const hour = Number(match[1]), minute = Number(match[2]);
    if (hour > 23 || minute > 59) return '—';
    return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'am' : 'pm'}`;
}
function solarDateLabel(localISO) {
    if (typeof localISO !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(localISO)) return '';
    const date = new Date(localISO.slice(0, 10) + 'T12:00:00Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', {
        timeZone: 'UTC', month: 'long', day: 'numeric'
    }).toUpperCase();
}

async function grabLocalForecast() {
    //includes 36 hour forecast and week ahead
    weatherInfo.dayDesc.days = [];
    weatherInfo.weekAhead.days = [];
    weatherInfo.almanac.days = [];
    weatherInfo.almanac.dateLabel = "";
    var url = "https://api.weather.com/v3/wx/forecast/daily/7day?geocode=" + locationConfig.mainCity.lat + "," + locationConfig.mainCity.lon + "&format=json&units=e&language=en-US&apiKey=" + api_key;
    $.getJSON(url, function (data) {
        var dayOfWeek = { 0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday" }
        //36 HOUR
        for (var i = (data.daypart[0].daypartName[0] === null ? 1 : 0); i < (data.daypart[0].daypartName[0] === null ? 5 : 4); i++) {
            var dayDescToAdd = {
                name: data.daypart[0].daypartName[i]
                    .replace("Tomorrow", dayOfWeek[new Date().getHours() > 3 ? new Date().getDay() : new Date().getDay() - 1])
                    .replace(" night", " Night"),
                desc: data.daypart[0].narrative[i].replaceAll("F. ", ". "),
                narrQualiCode: data.daypart[0].qualifierCode[i] == null ? "" : data.daypart[0].qualifierCode[i].replace("Q",""),
                iconCode: data.daypart[0].iconCodeExtend[i],
                cond: { name: codetoFcst[data.daypart[0].iconCodeExtend[i]].mov, time: data.daypart[0].daypartName[i].endsWith("night") ? "_night" : "_day" }
            }
            weatherInfo.dayDesc.days.push(dayDescToAdd);
        }
        //7 DAY
        for (var j = 0; j < 7; j++) {
            var dayWAtoAdd = { name: "", cond: "", icon: "", high: "", low: "", windspeed: "" }
            dayWAtoAdd.name = data.dayOfWeek[data.daypart[0].wxPhraseLong[0] === null ? j + 1 : j].substring(0, 3).toUpperCase();
            dayWAtoAdd.cond = data.daypart[0].wxPhraseLong[(data.daypart[0].wxPhraseLong[0] === null ? (j * 2 + 2) : (j * 2))].replaceAll("Thunderstorms", "Thunder storms").replaceAll("Scattered", "Sct'd").replaceAll("Thundershowers", "Thunder showers").replaceAll("/Wind", " & Windy").replaceAll("Rain/", "Rain, ").replaceAll("Clouds/PM", "Clouds, PM");
            dayWAtoAdd.icon = data.daypart[0].iconCodeExtend[(data.daypart[0].iconCodeExtend[0] === null ? (j * 2 + 2) : (j * 2))];
            dayWAtoAdd.high = data.daypart[0].temperature[(data.daypart[0].temperature[0] === null ? (j * 2 + 2) : (j * 2))];
            dayWAtoAdd.low = data.daypart[0].temperature[(data.daypart[0].temperature[0] === null ? (j * 2 + 3) : (j * 2 + 1))];
            if (data.daypart[0].temperature[0] != null && j === 0) {
                dayWAtoAdd.low = "";
            }
            weatherInfo.weekAhead.days.push(dayWAtoAdd)
        }
        //ALMANAC
        weatherInfo.almanac.noReport = false;
        var almOffset = data.dayOfWeek[0] === null ? 1 : 0;
        weatherInfo.almanac.dateLabel = solarDateLabel(data.validTimeLocal?.[almOffset] || data.sunriseTimeLocal?.[almOffset] || data.sunsetTimeLocal?.[almOffset]);
        var almanacDayOne = {
            day: data.dayOfWeek[almOffset].toUpperCase(),
            sunrise: formatSolarTime(data.sunriseTimeLocal?.[almOffset]),
            sunset: formatSolarTime(data.sunsetTimeLocal?.[almOffset])
        }
        weatherInfo.almanac.days.push(almanacDayOne);
        var almanacDayTwo = {
            day: data.dayOfWeek[almOffset + 1].toUpperCase(),
            sunrise: formatSolarTime(data.sunriseTimeLocal?.[almOffset + 1]),
            sunset: formatSolarTime(data.sunsetTimeLocal?.[almOffset + 1])
        }
        weatherInfo.almanac.days.push(almanacDayTwo);
    }).fail(function () {
        weatherInfo.dayDesc.noReport = true;
        weatherInfo.weekAhead.noReport = true;
        weatherInfo.almanac.noReport = true;
        var periods = ["Today", "Tonight", "Tomorrow"]
        for (var i = 0; i < 3; i++) {
            var dayDescToAddNR = { name: periods[i], desc: "Temporarily Unavailable" }
            weatherInfo.dayDesc.days.push(dayDescToAddNR);
        }
        for (var j = 0; j < 7; j++) {
            var dayOfWeek = { 0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun" }
            var dayWAtoAddNR = { name: dayOfWeek[(new Date().getDay() + j) % 7], cond: "", icon: 4400, high: "", low: "" }
            weatherInfo.weekAhead.days.push(dayWAtoAddNR);
        }
        weatherInfo.almanac.days.push({ day: "", sunrise: "", sunset: "" });
        weatherInfo.almanac.days.push({ day: "", sunrise: "", sunset: "" });
    })
    //console.log(weatherInfo.dayDesc);
    //console.log(weatherInfo.weekAhead);
}
//taken from joe's weatherstar jr sim
function grabMonthlyPrecip() {
    var url = "https://api.weather.com/v1/geocode/" + locationConfig.mainCity.lat + "/" + locationConfig.mainCity.lon + "/observations/current.json?language=en-US&units=e&apiKey=" + api_key;
    $.getJSON(url, function (data) {
        try {
            weatherInfo.monthlyPrecip = data.observation.imperial.precip_mtd.toFixed(2)
        } catch (error) {
            weatherInfo.monthlyPrecip = ""
        }
    }).fail(function () {
        weatherInfo.monthlyPrecip = ""
    })
}
async function grabAirQuality() {
    weatherInfo.airQuality.pollutants = [];
    var pollutantCount = 0;
    $.getJSON(`https://api.weather.com/v3/wx/globalAirQuality?geocode=${locationConfig.mainCity.lat},${locationConfig.mainCity.lon}&language=en-US&scale=EPA&format=json&apiKey=${api_key}`, function (data) {
        weatherInfo.airQuality.category = data.globalairquality.airQualityCategory;
        weatherInfo.airQuality.categoryIndex = data.globalairquality.airQualityCategoryIndex;
        for (pollutant in data.globalairquality.pollutants) {
            pollutantCount++;
            if (data.globalairquality.pollutants[pollutant].categoryIndex == data.globalairquality.airQualityCategoryIndex) {
                var phr = data.globalairquality.pollutants[pollutant].phrase.startsWith("Particulate matter") ? "Particulate matter" : data.globalairquality.pollutants[pollutant].phrase;
                weatherInfo.airQuality.pollutants.push(phr);
            }
        }
        if (weatherInfo.airQuality.pollutants.length == 0 || weatherInfo.airQuality.pollutants.length == pollutantCount) {
            weatherInfo.airQuality.pollutants = [];
            weatherInfo.airQuality.pollutants.push("None");
        }
    })
}

async function grabAlmanac() {
    var date = new Date();
    date.setDate(date.getDate() - 1);
    var yidx = new Date().getHours() >= 15 ? 1 : 0;
    $.getJSON(`https://api.weather.com/v3/aggcommon/v3-wx-conditions-historical-dailysummary-30day;v3-wx-almanac-daily-5day?geocode=${locationConfig.mainCity.lat},${locationConfig.mainCity.lon}&language=en-US&format=json&units=e&startDay=${date.getDate()}&startMonth=${date.getMonth() + 1}&apiKey=${api_key}`, function (data) {
        if(data["v3-wx-almanac-daily-5day"] == null){
            weatherInfo.almanac.noReport = true;
            return;
        }
        weatherInfo.almanac.stationname = locationConfig.mainCity.displayname.toUpperCase();
        weatherInfo.almanac.average.high = data["v3-wx-almanac-daily-5day"].temperatureAverageMax[1];
        weatherInfo.almanac.average.low = data["v3-wx-almanac-daily-5day"].temperatureAverageMin[1];
        weatherInfo.almanac.record.high = data["v3-wx-almanac-daily-5day"].temperatureRecordMax[1];
        weatherInfo.almanac.record.recordYearHigh = data["v3-wx-almanac-daily-5day"].almanacRecordYearMax[1];
        weatherInfo.almanac.record.low = data["v3-wx-almanac-daily-5day"].temperatureRecordMin[1];
        weatherInfo.almanac.record.recordYearLow = data["v3-wx-almanac-daily-5day"].almanacRecordYearMin[1];
        weatherInfo.almanac.yesterday.high = data["v3-wx-conditions-historical-dailysummary-30day"].temperatureMax[data["v3-wx-conditions-historical-dailysummary-30day"].temperatureMax.length - 1 - yidx]
        weatherInfo.almanac.yesterday.low = data["v3-wx-conditions-historical-dailysummary-30day"].temperatureMin[data["v3-wx-conditions-historical-dailysummary-30day"].temperatureMin.length - 1 - yidx]
    })
}

async function grabDaypartForecast() {
    weatherInfo.daypartForecast.times = [];
    var dpHours = [];
    var dayOfWeek = {
        0: ["SUNDAY", "SUN NIGHT/MON", "MONDAY"], 1: ["MONDAY", "MON NIGHT/TUE", "TUESDAY"], 2: ["TUESDAY", "TUE NIGHT/WED", "WEDNESDAY"], 3: ["WEDNESDAY", "WED NIGHT/THU", "THURSDAY"],
        4: ["THURSDAY", "THU NIGHT/FRI", "FRIDAY"], 5: ["FRIDAY", "FRI NIGHT/SAT"], 6: ["SATURDAY", "SAT NIGHT/SUN", "SUNDAY"]
    };
    var dpCurrent = dateFns.getHours(new Date())
    if (dpCurrent < 5) {
        weatherInfo.daypartForecast.dayName = dayOfWeek[new Date().getDay()][0];
        dpHours = [6, 12, 15, 17];
    } else if (dpCurrent >= 5 && dpCurrent < 10) {
        weatherInfo.daypartForecast.dayName = dayOfWeek[new Date().getDay()][0];
        dpHours = [12, 15, 17, 20];
    } else if (dpCurrent >= 10 && dpCurrent < 14) {
        weatherInfo.daypartForecast.dayName = dayOfWeek[new Date().getDay()][1];
        dpHours = [15, 17, 20, 0];
    } else if (dpCurrent >= 14 && dpCurrent < 16) {
        weatherInfo.daypartForecast.dayName = dayOfWeek[new Date().getDay()][2];
        dpHours = [17, 20, 0, 6];
    } else if (dpCurrent >= 16) {
        weatherInfo.daypartForecast.dayName = dayOfWeek[new Date().getDay()][2];
        dpHours = [6, 12, 15, 17];
    }
    var url = "https://api.weather.com/v3/wx/forecast/hourly/2day?geocode=" + locationConfig.mainCity.lat + "," + locationConfig.mainCity.lon + "&format=json&units=e&language=en-US&apiKey=" + api_key;
    $.getJSON(url, function (data) {
        // console.log(dateFns.getHours(data.validTimeLocal[0]));
        // console.log(data.precipChance[0]);
        if(data.precipChance[0] > 15){weatherInfo.specialModes.precip = true}
        var dpidx = 0;
        for (var i = 0; i < data.validTimeLocal.length; i++) {
            var dpTime = dateFns.getHours(data.validTimeLocal[i]);
            if (dpTime == dpHours[dpidx]) {
                var dayPartToAdd = { name: "", cond: "", icon: "", temp: "", wind: "", windspeed: "" }
                dayPartToAdd.name = { "0": "Midnight", "6": "6 am", "12": "Noon", "15": "3 pm", "17": "5 pm", "20": "8 pm" }[dpTime]
                dayPartToAdd.cond = data.wxPhraseLong[i].replaceAll("/Wind", " & Wind").replaceAll("Rain/", "Rain & ");
                dayPartToAdd.icon = data.iconCodeExtend[i]
                dayPartToAdd.temp = data.temperature[i]
                dayPartToAdd.wind = data.windSpeed[i] == 0 ? "Calm" : `${data.windDirectionCardinal[i]} ${data.windSpeed[i]}`
                dayPartToAdd.windspeed = data.windSpeed[i]
                weatherInfo.daypartForecast.times.push(dayPartToAdd);
                dpidx++;
            }
        }
    }).fail(function () {
        weatherInfo.daypartForecast.noReport = true;
        for (var i = 0; i < 4; i++) {
            weatherInfo.daypartForecast.times.push({ name: "", cond: "", icon: 4400, temp: "", wind: "", windspeed: "" });
        }
    })
}
var mapDataRequest = 0;
async function grabMapCityData(){
    // Refresh international geography from already-fetched nearby-city metadata.
    // No new geocoding service or changes to the weather polling schedule.
    regionalMapLayer.prepare();
    const request = ++mapDataRequest;
    const cities = locationConfig.regionalMap.map.slice();
    const cityKey = list => list.map(city => `${city.lat},${city.lon}`).join(';');
    const key = cityKey(cities);
    weatherInfo.map.mapCities = [];
    if (!cities.length) return;
    const url = 'https://api.weather.com/v3/aggcommon/v3-wx-observations-current;v3-wx-forecast-daily-3day?geocodes=' +
        key + '&language=en-US&units=e&format=json&apiKey=' + api_key;
    $.getJSON(url, function(data){
        // A response for the previous location must never label the new map.
        if (request !== mapDataRequest || key !== cityKey(locationConfig.regionalMap.map)) return;
        if (!Array.isArray(data)) return;
        const first = data.find(item => item?.['v3-wx-forecast-daily-3day']?.daypart?.[0]);
        if (!first) return;
        const daily = first['v3-wx-forecast-daily-3day'];
        const midx = daily.daypart[0].temperature[0] == null ? 1 : 0;
        weatherInfo.map.days = [
            daily.daypart[0].daypartName[midx],
            daily.daypart[0].daypartName[midx+1] === "Tomorrow" ? daily.dayOfWeek[1] : daily.daypart[0].daypartName[midx+1]
        ];
        // Keep slots aligned even when a station has no observation or forecast.
        weatherInfo.map.mapCities = cities.map((city, i) => {
            const observation = data[i]?.['v3-wx-observations-current'];
            const forecast = data[i]?.['v3-wx-forecast-daily-3day']?.daypart?.[0];
            return {
                name: city.name,
                current: { temp: observation?.temperature ?? '', icon: observation?.iconCodeExtend ?? 'blank' },
                forecasts: [midx, midx+1].map(period => ({
                    temp: forecast?.temperature?.[period] ?? '',
                    icon: forecast?.iconCodeExtend?.[period] ?? 'blank'
                }))
            };
        });
    });
}

async function grabAlerts() {
    weatherInfo.bulletin.alerts = [];
    weatherInfo.bulletin.enabled = false;
    weatherInfo.bulletin.crawlAlert.enabled = false;
    weatherInfo.specialModes.bulletin = false
    $.getJSON(`https://api.weather.com/v3/alerts/headlines?geocode=${locationConfig.mainCity.lat},${locationConfig.mainCity.lon}&format=json&language=en-US&apiKey=${api_key}`, function (data) {
        if (!data) {
            weatherInfo.bulletin.enabled = false;
            weatherInfo.bulletin.crawlAlert.enabled = false;
            weatherInfo.bulletin.crawlAlert.alert = undefined;
            endAlertCrawl();
            return;
        }
        weatherInfo.bulletin.enabled = true;
        for (let i = 0; i < data.alerts.length; i++) {
            if(data.alerts[i].eventDescription == "Special Weather Statement"){
                grabAlertCrawl(data.alerts[i].detailKey);
                continue;
            }
            var bulletinAlert = {
                name: data.alerts[i].eventDescription,
                significance: data.alerts[i].significance,
                desc: data.alerts[i].headlineText,
                detailKey: data.alerts[i].detailKey,
                severity: data.alerts[i].severity
            }
            
            if(warningSettings[data.alerts[i].eventDescription]){
                bulletinAlert.priority = warningSettings[data.alerts[i].eventDescription].priority
                if(!warningSettings[data.alerts[i].eventDescription].included){
                    return;
                }
            }
            else{bulletinAlert.priority = 125;}

            var sameBulletin = false;
            for(let j = 0; j < weatherInfo.bulletin.alerts.length; j++){
                if(data.alerts[i].eventDescription == weatherInfo.bulletin.alerts[j].name){
                    sameBulletin = true;
                }
            }
            if(sameBulletin){continue}
            if (weatherInfo.bulletin.crawlAlert.enabled == false && data.alerts[i].urgencyCode == 1) {
                weatherInfo.bulletin.crawlAlert.enabled = true;
                grabAlertCrawl(bulletinAlert.detailKey);
            } else {
                weatherInfo.bulletin.alerts.push(bulletinAlert);
            }
        }
        weatherInfo.bulletin.alerts = weatherInfo.bulletin.alerts.sort((a, b) => a.priority - b.priority);
        if(weatherInfo.bulletin.alerts.length > 0){weatherInfo.specialModes.bulletin = true}
        else{
            weatherInfo.specialModes.bulletin = false;
            weatherInfo.bulletin.enabled = false;
            weatherInfo.bulletin.crawlAlert.enabled = false;
            weatherInfo.bulletin.crawlAlert.alert = undefined;
            endAlertCrawl();
        }
    }).fail(function () {
        if(weatherInfo.bulletin.alerts.length <= 0){weatherInfo.specialModes.bulletin = false}
        weatherInfo.bulletin.enabled = false;
        weatherInfo.bulletin.crawlAlert.enabled = false;
        weatherInfo.bulletin.crawlAlert.alert = undefined;
        endAlertCrawl();
    })
}
function grabAlertCrawl(dKey) {
    weatherInfo.bulletin.crawlAlert.enabled = true;
    if(weatherInfo.bulletin.crawlAlert.alert != undefined){
        if(weatherInfo.bulletin.crawlAlert.alert.detailKey == dKey) return;
    }
    $.getJSON('https://api.weather.com/v3/alerts/detail?alertId=' + dKey + '&format=json&language=en-US&apiKey=' + api_key, function (data) {
        console.log(data);
        if(weatherInfo.bulletin.crawlAlert.alert != undefined && (weatherInfo.bulletin.crawlAlert.alert.priority > warningSettings[data.alertDetail.eventDescription].priority)) return;
        var alert = {
            name: data.alertDetail.eventDescription,
            code: data.alertDetail.productIdentifier,
            type: data.alertDetail.messageType,
            significance: data.alertDetail.significance,
            description: data.alertDetail.texts[0].description,
            severe: warningSettings[data.alertDetail.eventDescription].severe,
            priority: warningSettings[data.alertDetail.eventDescription].priority,
            detailKey: dKey
        }
        if (alert.severe) {
            weatherInfo.bulletin.crawlAlert.alert = [];
        }
        weatherInfo.bulletin.crawlAlert.alert = alert;
        setTimeout(startAlertCrawl, 1000);
    });
}
async function grabMoonphases(){
    await $.getJSON(`https://www.icalendar37.net/lunar/api/?lang=en&month=${dateFns.format(new Date(),"M")}&year=${dateFns.format(new Date(),"YYYY")}`, function(data){
        for(phase in data.phase){
            if(data.phase[phase].isPhaseLimit != false){
                if(phase < new Date().getDate()){ continue; }
                var moonphaseToAdd = {date:"",type:""}
                moonphaseToAdd.date = data.monthName.substring(0,3) + " " + phase;
                moonphaseToAdd.type = data.phase[phase].phaseName.split(" ")[0];
                weatherInfo.almanac.moonphases.push(moonphaseToAdd);
            }
        }
    })
    await $.getJSON(`https://www.icalendar37.net/lunar/api/?lang=en&month=${dateFns.format(dateFns.addMonths(new Date(),1),"M")}&year=${dateFns.format(new Date(),"YYYY")}`, function(data){
        for(phase in data.phase){
            if(data.phase[phase].isPhaseLimit != false){
                var moonphaseToAdd = {date:"",type:""}
                moonphaseToAdd.date = data.monthName.substring(0,3) + " " + phase;
                moonphaseToAdd.type = data.phase[phase].phaseName.split(" ")[0]
                weatherInfo.almanac.moonphases.push(moonphaseToAdd);
            }
        }
    })
}
async function grabOutdoorActivityData(){
    var oaCurrent = () => {
        if(dateFns.getHours(new Date()) <= 6){
            return 9;
        }else if(dateFns.getHours(new Date()) <= 11){
            //weatherInfo.outdoorActivity.bg = 2; //so it has come to my attention that v2 has two images instead of one, whatever ig
            return 14;
        }else if(dateFns.getHours(new Date()) <= 16){
            weatherInfo.outdoorActivity.bg = 3;
            return 19;
        }
        return 9;
    }
    var url = "https://api.weather.com/v3/wx/forecast/hourly/1day?geocode=" + locationConfig.mainCity.lat + "," + locationConfig.mainCity.lon + "&format=json&units=e&language=en-US&apiKey=" + api_key;
    $.getJSON(url, function(data){
        try {
            for(let i = 0; i < data.validTimeLocal.length; i++){
                if(dateFns.getHours(data.validTimeLocal[i]) == oaCurrent()){
                    weatherInfo.outdoorActivity.time = `${dateFns.format(data.validTimeLocal[i], 'h')}${oaCurrent() == 9 ? "am" : "pm"} ${data.dayOfWeek[i]}`;
                    weatherInfo.outdoorActivity.temp = data.temperature[i];
                    weatherInfo.outdoorActivity.cond = data.wxPhraseLong[i];
                    weatherInfo.outdoorActivity.icon = data.iconCodeExtend[i];
                    weatherInfo.outdoorActivity.wind = data.windDirectionCardinal[i] + " " + data.windSpeed[i];
                    if(data.temperatureHeatIndex[i] > data.temperature[i] + 3){
                        weatherInfo.outdoorActivity.feelslike.type = "Heat Index";
                        weatherInfo.outdoorActivity.feelslike.val = data.temperatureHeatIndex[i];
                    }else if(data.temperatureWindChill[i] < data.temperature[i] - 3){
                        weatherInfo.outdoorActivity.feelslike.type = "Wind Chill";
                        weatherInfo.outdoorActivity.feelslike.val = data.temperatureWindChill[i];
                    }
                    break;
                }
            }
        } catch (error) {
            weatherInfo.outdoorActivity.noReport = true;
        }
    }).fail(function(){
        weatherInfo.outdoorActivity.noReport = true;
    })
}