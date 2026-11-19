//wanted to make my own slides class but I think Joe's syntax for slides were better
var slideDivs = {
    "currentConditions": ".current-conditions",
    "nearbyCities": ".eight-cities",
    "dayDesc": ".local-forecast",
    "weekAhead": ".week-ahead",
    "airQuality": ".air-quality",
    "dopplerRadar": ".radar",
    "daypartForecast": ".daypart-forecast",
    "almanac": ".almanac",
    "bulletin": ".bulletin"
}

//to be used later
var slideHeaders = {
    "currentConditions": "*city*",
    "nearbyCities": "",
    "dayDesc": "*city* *ending*",
    "weekAhead": "*city* *ending*"
}

var slideFlavor = {
    flavor: '',
    bulletin: false,
    precip: false,
    order: slideSettings.order
}

var slideLength;
var currentProgram;
var currentDiv;
var idx = 0, nidx = 1;

// Slide-owned callbacks cannot leak into the next product or extend radar playback.
const slideTimers = new Set();
const slideCleanups = new Set();
let slideEpoch = 0;
function slideSchedule(callback, delay) {
    const epoch = slideEpoch;
    const timer = setTimeout(() => {
        slideTimers.delete(timer);
        if (epoch === slideEpoch) callback();
    }, Math.max(0, Number(delay) || 0));
    slideTimers.add(timer);
    return timer;
}
function clearSlideTimers() {
    slideEpoch++;
    for (const timer of slideTimers) clearTimeout(timer);
    slideTimers.clear();
    for (const cleanup of slideCleanups) cleanup();
    slideCleanups.clear();
}
// Product changes are broadcast-style switches, not opacity dissolves. DOM
// changes in the same task are painted together, retaining the authored inner
// title/panel animations without blending two different products on screen.
function showSlide(selector) {
    $(selector).stop(true, false).css('opacity', '').show();
}
function hideSlide(selector) {
    $(selector).stop(true, false).hide().css('opacity', '');
}

// Keep the outgoing radar intact until the incoming canvas has actually painted
// a complete frame. The title and entire map stack then switch together.
function radarHandoff(map, commit) {
    const epoch = slideEpoch;
    let finished = false, timeout;
    const cleanup = () => {
        finished = true;
        map.off('render', rendered);
        clearTimeout(timeout);
        slideTimers.delete(timeout);
        slideCleanups.delete(cleanup);
    };
    const finish = () => {
        if (finished || epoch !== slideEpoch) return;
        cleanup();
        commit();
    };
    const rendered = () => {
        const current = radarState(map).current;
        if (current !== null && radarFrameReady(map, current)) finish();
    };
    map.on('render', rendered);
    slideCleanups.add(cleanup);
    // A provider outage must not hold the old geographic view indefinitely or
    // extend the product duration. Fall back to the incoming basemap promptly.
    timeout = slideSchedule(finish, 500);
}
function slideKickOff() {
    clearSlideTimers();
    if (typeof stopRadar === 'function') stopRadar();
    $('.slides > div, .radar-group').stop(true, false).hide().css({ opacity: '', visibility: '' });
    idx = 0;
    nidx = 1;
    showSlides();
}
function slideCallBack() {
    idx++;
    nidx++;
    showSlides();
}
// Keep the same accessible title text in every package. Separate spans let
// only the 2005–06 stylesheet give the period and product different treatments.
function setMapHeader(period, current = false) {
    const lead = current ? 'Now' : period ? `${period}'s` : 'Regional';
    const header = $('.map .header').empty();
    header.append($('<span>').addClass('map-title-lead').text(lead));
    if (!current) header.append(document.createTextNode(' '));
    header.append($('<span>').addClass('map-title-tail').text(current ? '' : 'Forecast'));
    header.attr('data-map-title', current ? 'current' : 'forecast');
}

var slidePrograms = {
    currentConditions() {
        try {
            audioPlayer.vocallocal.cc = vocallocalCC()
            showSlide('.current-conditions');
            $(".current-conditions .city-name").text(locationConfig.mainCity.displayname.toUpperCase());
            $(".current-conditions .cond").text(weatherInfo.currentConditions.cond);
            $(".current-conditions .temp").text(weatherInfo.currentConditions.temp);
            $(".current-conditions .humidity").text(weatherInfo.currentConditions.humidity);
            $(".current-conditions .dewpoint").text(weatherInfo.currentConditions.dewpoint + "°");
            $(".current-conditions .pressure .data").text(weatherInfo.currentConditions.pressure.val);
            $(".current-conditions .visibility .data").text(weatherInfo.currentConditions.visibility);
            $(".current-conditions .wind").text(weatherInfo.currentConditions.wind);
            if (weatherInfo.currentConditions.gusts != "None") {
                $(".current-conditions .gusts .data").text(weatherInfo.currentConditions.gusts);
                $(".current-conditions .gusts .miles").fadeIn(0);
            } else {
                $(".current-conditions .gusts .none").fadeIn(0);
                $(".current-conditions .gusts .miles").fadeOut(0);
            }
            if (weatherInfo.currentConditions.feelslike.type != null) {
                $('.current-conditions .labels').append(`${weatherInfo.currentConditions.feelslike.type.toUpperCase()}`);
                $('.current-conditions .feelslike').fadeIn(0);
                $('.current-conditions .feelslike').text(weatherInfo.currentConditions.feelslike.val + "°");
            }
            getIcon($('.current-conditions .icon'), weatherInfo.currentConditions.icon, "current", "large");

            $('.current-conditions .box').fadeIn(167, 'linear');
            $('.current-conditions .header').fadeIn(333, 'linear');
            audioPlayer.playCC(true);

            slideSchedule(() => {
                $('.current-conditions .box').fadeOut(167, 'linear');
                $('.current-conditions .header').fadeOut(333, 'linear');
                slideSchedule(() => {
                    hideSlide('.current-conditions');
                    slideCallBack();
                }, 333);
            }, slideLength - 333);
        } catch (error) {
            showSlide('.current-conditions');
            $(".current-conditions .city-name").text(locationConfig.mainCity.displayname.toUpperCase());
            $('.current-conditions .box').fadeIn(167, 'linear');
            $('.current-conditions .header').fadeIn(333, 'linear');
            $('.current-conditions .right-pane').fadeOut(0);

            slideSchedule(() => {
                $('.current-conditions .box').fadeOut(167, 'linear');
                $('.current-conditions .header').fadeOut(333, 'linear');
                slideSchedule(() => {
                    hideSlide('.current-conditions');
                    slideCallBack();
                }, 333);
            }, slideLength - 333);
        }
    },
    nearbyCities() {
        try {
            if (weatherInfo.eightCities.cities.length == 0) {
                throw new Error("No local observations");
            }
            showSlide('.eight-cities');
            function eightCities(offset) {
                var loDivs = ["i", "ii", "iii", "iv"];
                for (var i = 0; i < 4; i++) {
                    $(`.extra-loc.${loDivs[i]} .name`).text(weatherInfo.eightCities.cities[i + offset].name);
                    $(`.extra-loc.${loDivs[i]} .temp`).text(weatherInfo.eightCities.cities[i + offset].temp);
                    $(`.extra-loc.${loDivs[i]} .wind .direction`).text(weatherInfo.eightCities.cities[i + offset].wind.direction);
                    $(`.extra-loc.${loDivs[i]} .wind .speed`).text(weatherInfo.eightCities.cities[i + offset].wind.speed == 0 ? "" : weatherInfo.eightCities.cities[i + offset].wind.speed);
                    getIcon($(`.extra-loc.${loDivs[i]} .icon`), weatherInfo.eightCities.cities[i + offset].icon, "current", "large");
                }
            }

            eightCities(0);
            $('.eight-cities .box').fadeIn(167, 'linear');
            $('.eight-cities .header').fadeIn(333, 'linear');
            if (weatherInfo.eightCities.cities.length > 4) {
                slideSchedule(() => {
                    $(".eight-cities .information").fadeOut(167, 'linear');
                    slideSchedule(() => {
                        eightCities(4);
                        $(".eight-cities .information").fadeIn(167, 'linear');
                    }, 167);
                    slideSchedule(() => {
                        $('.eight-cities .box').fadeOut(167, 'linear');
                        $('.eight-cities .header').fadeOut(333, 'linear');
                        slideSchedule(() => {
                            hideSlide('.eight-cities');
                            slideCallBack();
                        }, 333, 'linear');
                    }, slideLength - 333);
                }, slideLength);
            } else {
                slideSchedule(() => {
                    $('.eight-cities .box').fadeOut(167, 'linear');
                    $('.eight-cities .header').fadeOut(333, 'linear');
                    slideSchedule(() => {
                        hideSlide('.eight-cities');
                        slideCallBack();
                    }, 333, 'linear');
                }, slideLength - 333);
            }
        } catch (error) {
            if (weatherInfo.eightCities.cities.length == 0) {
                hideSlide('.eight-cities');
                slideCallBack();
                throw new Error("No local observations");
            }
        }

    },
    localForecast(lidx) {
        if (lidx === undefined) { lidx = 0 }
        if (audioSettings.vocallocal) audioPlayer.vocallocal.lf = vocallocalLF(lidx, slideLength);
        showSlide('.local-forecast');
        $('.local-forecast .box').fadeIn(167, 'linear');
        $('.local-forecast .header').fadeIn(333, 'linear');
        $('.local-forecast .information').fadeIn(167, 'linear');
        $('.local-forecast .desc-mov').fadeIn(167, 'linear');

        $('.local-forecast .city-name').text(locationConfig.mainCity.extraname.toUpperCase());
        $('.local-forecast .period').text(weatherInfo.dayDesc.days[lidx].name);
        $('.local-forecast .description').text(weatherInfo.dayDesc.days[lidx].desc);
        $('.local-forecast .desc-mov').css({
            'background-image': `url(images/localforecast/${weatherInfo.dayDesc.days[lidx].cond.name}${showNight(weatherInfo.dayDesc.days[lidx], idx) ? weatherInfo.dayDesc.days[lidx].cond.time : ""}.png)`
        });
        if (!audioSettings.vocallocal) {
            if (lidx == 0) { audioPlayer.playLF(); }
        } else {
            audioPlayer.playLF();
        }
        if (lidx >= slideFlavor.order[idx].slides - 1) {
            slideSchedule(() => {
                $('.local-forecast .box').fadeOut(167, 'linear');
                $('.local-forecast .header').fadeOut(333, 'linear');
                $('.local-forecast .desc-mov').fadeOut(167, 'linear');
                slideSchedule(() => {
                    hideSlide('.local-forecast');
                    slideCallBack();
                }, 333);
            }, slideLength - 333);
        } else {
            slideSchedule(() => {
                $('.local-forecast .information').fadeOut(167, 'linear');
                $('.local-forecast .desc-mov').fadeOut(167, 'linear');
                slideSchedule(() => {
                    slidePrograms.localForecast(lidx + 1);
                }, 333);
            }, slideLength - 333);
        }
    },
    weekAhead() {
        audioPlayer.playEF();
        showSlide('.week-ahead');
        $('.week-ahead .box').fadeIn(167, 'linear');
        $('.week-ahead .header').fadeIn(333, 'linear');
        $('.week-ahead .city-name').text(locationConfig.mainCity.extraname.toUpperCase());

        var waDivs = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
        for (var i = 0; i < 7; i++) {
            if (weatherInfo.weekAhead.days[i].name == "SAT" || weatherInfo.weekAhead.days[i].name == "SUN") {
                $(`.week-ahead .day.${waDivs[i]} .weekend`).fadeIn(0);
                $(`.week-ahead .day.${waDivs[i]} .name`).addClass("wk");
            }
            $(`.week-ahead .day.${waDivs[i]} .name`).text(weatherInfo.weekAhead.days[i].name);
            $(`.week-ahead .day.${waDivs[i]} .cond`).text(weatherInfo.weekAhead.days[i].cond);
            $(`.week-ahead .day.${waDivs[i]} .high`).text(weatherInfo.weekAhead.days[i].high);
            $(`.week-ahead .day.${waDivs[i]} .low`).text(weatherInfo.weekAhead.days[i].low);
            getIcon($(`.week-ahead .day.${waDivs[i]} .icon`), weatherInfo.weekAhead.days[i].icon, "forecast", "large");
        }
        slideSchedule(() => {
            $('.week-ahead .box').fadeOut(167, 'linear');
            $('.week-ahead .header').fadeOut(333, 'linear');
            slideSchedule(() => {
                hideSlide('.week-ahead');
                slideCallBack();
            }, 333);
        }, slideLength - 333);
    },
    airQuality() {
        showSlide('.air-quality');
        $('.air-quality .box').fadeIn(167, 'linear');
        $('.air-quality .header').fadeIn(333, 'linear');
        $('.air-quality .qualityarrow').fadeIn(167, 'linear');
        $('.air-quality .city-name').text(locationConfig.mainCity.displayname.toUpperCase());
        var arrowAnim = 317.5 + (95 * (weatherInfo.airQuality.categoryIndex - 1));
        var aqDiv = { 1: "low", 2: "moderate", 3: "unhealthy", 4: "high", 5: "extreme" }[weatherInfo.airQuality.categoryIndex];
        var day = { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" }[new Date().getDay()]
        $('.air-quality .day').text(day + ":");
        for (var i = 0; i < weatherInfo.airQuality.pollutants.length; i++) {
            $('.primpollut .pollutants').append(`<span>${weatherInfo.airQuality.pollutants[i]}</span>`);
        }
        slideSchedule(() => {
            $('.air-quality .qualityarrow').animate({ "bottom": `${arrowAnim}px` }, 500, 'linear', function () {
                $(`.qualitybar .${aqDiv} span.text`).fadeIn(500);
            })
        }, 167);

        slideSchedule(() => {
            $('.air-quality .header').fadeOut(333, 'linear');
            slideSchedule(() => {
                hideSlide('.air-quality');
                slideCallBack();
            }, 333);
        }, slideLength - 333);
    },
    almanac() {
        showSlide('.almanac');
        $('.almanac .box').fadeIn(167, 'linear');
        $('.almanac .header').fadeIn(333, 'linear');
        $('.almanac .day.i .almheader').text(weatherInfo.almanac.days[0].day);
        $('.almanac .day.i .sunrise').html(weatherInfo.almanac.days[0].sunrise.replace("am", "<span>am</span>").replace("pm", "<span>pm</span>"));
        $('.almanac .day.i .sunset').html(weatherInfo.almanac.days[0].sunset.replace("am", "<span>am</span>").replace("pm", "<span>pm</span>"));
        $('.almanac .day.ii .almheader').text(weatherInfo.almanac.days[1].day);
        $('.almanac .day.ii .sunrise').html(weatherInfo.almanac.days[1].sunrise.replace("am", "<span>am</span>").replace("pm", "<span>pm</span>"));
        $('.almanac .day.ii .sunset').html(weatherInfo.almanac.days[1].sunset.replace("am", "<span>am</span>").replace("pm", "<span>pm</span>"));
        $('.almanac .stationname').text(weatherInfo.almanac.stationname);
        $('.almanac .almdate').text(weatherInfo.almanac.dateLabel || '');
        $('.almanac .yesterday .high').text(weatherInfo.almanac.yesterday.high);
        $('.almanac .yesterday .low').text(weatherInfo.almanac.yesterday.low);
        $('.almanac .average .high').text(weatherInfo.almanac.average.high);
        $('.almanac .average .low').text(weatherInfo.almanac.average.low);
        $('.almanac .records .high').text(weatherInfo.almanac.record.high);
        $('.almanac .records .low').text(weatherInfo.almanac.record.low);
        $('.almanac .records .highyear').text(weatherInfo.almanac.record.recordYearHigh);
        $('.almanac .records .lowyear').text(weatherInfo.almanac.record.recordYearLow);

        slideSchedule(() => {
            $('.almanac .box').fadeOut(167, 'linear');
            $('.almanac .header').fadeOut(333, 'linear');
            slideSchedule(() => {
                hideSlide('.almanac');
                slideCallBack();
            }, 333);
        }, slideLength - 333);
    },
    radarDoppler() {
        audioPlayer.playRadar();
        showRadarSlide('regional');
    },
    localDoppler() {
        showRadarSlide('local');
    },
    daypartForecast() {
        //highest = 202, lowest = 78
        showSlide('.daypart-forecast');
        $('.daypart-forecast .header').fadeIn(167, 'linear');
        $('.daypart-forecast .box').fadeIn(133, 'linear');
        $('.daypart-forecast .city-name').text(locationConfig.mainCity.extraname.toUpperCase());
        $('.daypart-forecast .forecast-period').text(weatherInfo.daypartForecast.dayName);
        var dpDivs = ["i", "ii", "iii", "iv"];
        var barTemps = [
            weatherInfo.daypartForecast.times[0].temp,
            weatherInfo.daypartForecast.times[1].temp,
            weatherInfo.daypartForecast.times[2].temp,
            weatherInfo.daypartForecast.times[3].temp,
        ]
        var barMin = Math.min(...barTemps);
        var barMax = Math.max(...barTemps);
        var barRange = barMax - barMin;
        var barminHeight = 78;
        for (let i = 0; i < 4; i++) {
            $(`.daypart-forecast .hour.${dpDivs[i]} .time`).text(weatherInfo.daypartForecast.times[i].name);
            getIcon($(`.daypart-forecast .hour.${dpDivs[i]} .icon`), weatherInfo.daypartForecast.times[i].icon, "forecast", "large");
            $(`.daypart-forecast .hour.${dpDivs[i]} .cond`).text(weatherInfo.daypartForecast.times[i].cond);
            $(`.daypart-forecast .hour.${dpDivs[i]} .wind`).text(weatherInfo.daypartForecast.times[i].wind);
            $(`.daypart-forecast .hour.${dpDivs[i]} .bar .temp`).text(weatherInfo.daypartForecast.times[i].temp);
            let barHgtMultipler = barRange == 0 ? 202 : ((weatherInfo.daypartForecast.times[i].temp - barMin) / barRange) * 124;
            let dpDiv = dpDivs[i];
            slideSchedule(() => {
                $(`.daypart-forecast .hour.${dpDiv} .bar`).animate({ "height": `${(barHgtMultipler + barminHeight)}px` }, 167, 'linear', function () {
                    $(`.daypart-forecast .hour.${dpDiv} .bar .temp`).fadeIn(133)
                });
            }, 267 * (i + 1));
        }

        slideSchedule(() => {
            $('.daypart-forecast .header').fadeOut(167, 'linear');
            $('.daypart-forecast .box').fadeOut(167, 'linear');
            slideSchedule(() => {
                hideSlide('.daypart-forecast');
                slideCallBack();
            }, 167);
        }, slideLength - 167);
    },
    bulletin() {
        console.log(vocallocalBulletin());
        audioPlayer.vocallocal.bl = vocallocalBulletin();
        var text = "";
        for (var i = 0; i < (weatherInfo.bulletin.alerts.length > 2 ? 2 : weatherInfo.bulletin.alerts.length); i++) {
            text = text + `<span>${weatherInfo.bulletin.alerts[i].desc}</span><br>`
        }
        showSlide('.bulletin');
        $('.bulletin .alerts').empty();
        $('.bulletin .alerts').append(text);

        audioPlayer.playBulletin();
        slideSchedule(() => {
            $('.bulletin .header').fadeOut(167, 'linear');
            $('.bulletin .alerts').fadeOut(167, 'linear');
            slideSchedule(() => {
                hideSlide('.bulletin');
                slideCallBack();
            }, 167);
        }, slideLength - 167);
    },
    mapTest() {
        regionalMapLayer.render();
        $('.map-cities .city').hide();
        showSlide('.map');
        var mapDivs = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
        for (let i = 0; i < locationConfig.regionalMap.map.length; i++) {
            $(`.map-cities .city.${mapDivs[i]}`).fadeIn(0);
            $(`.map-cities .city.${mapDivs[i]} .city-name`).text(locationConfig.regionalMap.map[i].name)
            $(`.map-cities .city.${mapDivs[i]}`).css({ left: locationConfig.regionalMap.map[i].left, top: locationConfig.regionalMap.map[i].top })
        }
    },
    mapCurrent() {
        regionalMapLayer.render();
        $('.map-cities .city').hide();
        showSlide('.map');
        setMapHeader(null, true);
        $('.map .header').fadeIn(167, 'linear');
        var mapDivs = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
        for (let i = 0; i < locationConfig.regionalMap.map.length; i++) {
            try {
                $(`.map-cities .city.${mapDivs[i]}`).fadeIn(0);
                $(`.map-cities .city.${mapDivs[i]} .city-name`).text(locationConfig.regionalMap.map[i].name);
                $(`.map-cities .city.${mapDivs[i]}`).css({ left: locationConfig.regionalMap.map[i].left, top: locationConfig.regionalMap.map[i].top });
                $(`.map-cities .city.${mapDivs[i]} .temp`).text(weatherInfo.map.mapCities[i].current.temp);
                getIcon($(`.map-cities .city.${mapDivs[i]} .icon`), weatherInfo.map.mapCities[i].current.icon, "current", "large");
            } catch (error) {
                $(`.map-cities .city.${mapDivs[i]} .temp`).text("");
                getIcon($(`.map-cities .city.${mapDivs[i]} .icon`), "blank", "current", "large");
            }
        }

        slideSchedule(() => {
            $('.map .header').fadeOut(167, 'linear');
            slideSchedule(() => {
                hideSlide('.map');
                slideCallBack();
            }, 167);
        }, slideLength - 167);
    },
    mapForecast(midx) {
        regionalMapLayer.render();
        $('.map-cities .city').hide();
        if (midx === undefined) { midx = 0; }
        showSlide('.map');
        setMapHeader(weatherInfo.map.days[midx]);
        $('.map .header').fadeIn(167, 'linear');
        var mapDivs = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
        for (let i = 0; i < locationConfig.regionalMap.map.length; i++) {
            try {
                $(`.map-cities .city.${mapDivs[i]}`).fadeIn((midx == 0 ? 0 : 167), 'linear');
                $(`.map-cities .city.${mapDivs[i]} .city-name`).text(locationConfig.regionalMap.map[i].name);
                $(`.map-cities .city.${mapDivs[i]}`).css({ left: locationConfig.regionalMap.map[i].left, top: locationConfig.regionalMap.map[i].top });
                $(`.map-cities .city.${mapDivs[i]} .temp`).text(weatherInfo.map.mapCities[i].forecasts[midx].temp);
                getIcon($(`.map-cities .city.${mapDivs[i]} .icon`), weatherInfo.map.mapCities[i].forecasts[midx].icon, "forecast", "large");
            } catch (error) {
                $(`.map-cities .city.${mapDivs[i]} .temp`).text("");
                getIcon($(`.map-cities .city.${mapDivs[i]} .icon`), "blank");
            }
        }

        slideSchedule(() => {
            if (slideFlavor.order[idx].slides == undefined) {
                $('.map .header').fadeOut(167, 'linear');
                slideSchedule(() => {
                    hideSlide('.map');
                    slideCallBack();
                }, 167);
            } else {
                if (midx >= slideFlavor.order[idx].slides - 1) {
                    $('.map .header').fadeOut(167, 'linear');
                    slideSchedule(() => {
                        hideSlide('.map');
                        slideCallBack();
                    }, 167);
                } else {
                    $('.map .header').fadeOut(167, 'linear');
                    for (let i = 0; i < locationConfig.regionalMap.map.length; i++) {
                        $(`.map-cities .city.${mapDivs[i]}`).fadeOut(167);
                    }
                    slideSchedule(() => {
                        hideSlide('.map');
                        slidePrograms.mapForecast(midx + 1);
                    }, 167);
                }
            }
        }, slideLength - 167);
    },
    outdoorActivity(){
        showSlide('.outdoor-activity');
        $(".outdoor-activity .header").fadeIn(133, 'linear');
        $(".outdoor-activity .box").fadeIn(0);
        $(".outdoor-activity .outdoor-bg").css({'background-image': `url(images/outdoorActivity${weatherInfo.outdoorActivity.bg}.png)`, 'background-size': '100% 100%'});
        $(".outdoor-activity .outdoor-bg").fadeIn(300, 'linear');

        $(".outdoor-activity .time").text(weatherInfo.outdoorActivity.time);
        $(".outdoor-activity .temp").text(weatherInfo.outdoorActivity.temp);
        $(".outdoor-activity .cond").text(weatherInfo.outdoorActivity.cond);
        $(".outdoor-activity .wind .val").text(weatherInfo.outdoorActivity.wind);
        if(weatherInfo.outdoorActivity.feelslike.type == undefined){
            $(".outdoor-activity .feelslike").fadeOut(0);
        }else{
            $(".outdoor-activity .feelslike .heading").text(weatherInfo.outdoorActivity.feelslike.type.toUpperCase());
            $(".outdoor-activity .feelslike .val").text(weatherInfo.outdoorActivity.feelslike.val + "°");
        }
        getIcon($(".outdoor-activity .icon"), weatherInfo.outdoorActivity.icon, "forecast", "large");

        slideSchedule(() => {
            $(".outdoor-activity .outdoor-bg").fadeOut(300, 'linear');
            slideSchedule(() => {
                $(".outdoor-activity .header").fadeOut(133, 'linear');
            }, 167);
            slideSchedule(() => {
                hideSlide('.outdoor-activity');
                slideCallBack();
            }, 300);
        }, slideLength - 300);
    }
} //end of slidePrograms
function showRadarSlide(kind, onDone, keepRadar = false) {
    const local = kind === 'local';
    const map = local ? locradar : regradar;
    const group = local ? '.local-radar-group' : '.regional-radar-group';
    const other = local ? '.regional-radar-group' : '.local-radar-group';
    const maps = local ? [locmap, locradar, locoutlines, locoutlinestrans] : [regmap, regradar, regoutlines, regoutlinestrans];
    const handoff = $('.radar').css('display') !== 'none' &&
        $(other).css('display') !== 'none' && $(other).css('visibility') !== 'hidden';
    showSlide('.radar');
    // Staging with visibility:hidden keeps the incoming canvas at its full size.
    // Never scale, move, or alpha-blend radar geography to simulate a transition.
    showSlide(group);
    $(group).css('visibility', handoff ? 'hidden' : '');
    $(local ? '#locmap, #locradar' : '#regmap, #regradar').show();
    const outlines = local ? '#locoutlines, #locoutlinestrans' : '#regoutlines, #regoutlinestrans';
    const cities = local ? '.loc-cities, .loc-cities-trans' : '.reg-cities, .reg-cities-trans';
    if (mapStyle === "mapbox://styles/colster/cmiccqynn00as01s4bt6501il") {
        addRadarCities();
        $(outlines).show();
        $(cities).show();
    } else {
        $(outlines).hide();
        $(cities).hide();
    }
    maps.forEach(map => map.resize());
    const reveal = () => {
        $(group).css('visibility', '');
        hideSlide(other);
        if (typeof setRadarTimelineMap === 'function') setRadarTimelineMap(map);
        $('.radar').attr('data-radar-region', local ? 'local' : 'regional');
        const regionalPackage = document.documentElement.dataset.package === '2005-regional';
        $('.radar .header').stop(true, false).css('opacity', '').attr('data-radar-region', local ? 'local' : 'regional').text(regionalPackage ? 'RADAR/SATELLITE' : (local ? 'Local Doppler' : 'Regional Doppler')).show();
    };
    if (handoff) radarHandoff(map, reveal);
    else reveal();
    startRadar(map);
    slideSchedule(() => {
        // Stop on the product deadline, not when another radar loop finishes.
        if (local) stopRadar(locradar);
        else stopRadar(regradar);
        const next = slideFlavor.order[idx + 1]?.function;
        if (!keepRadar && !['radarDoppler', 'localDoppler'].includes(next)) hideSlide('.radar');
        if (onDone) onDone(); else slideCallBack();
    }, slideLength);
}

function showSlides() {
    clearSlideTimers();
    if (typeof stopRadar === 'function') stopRadar();
    if (idx >= slideFlavor.order.length) {
        $('#main').stop(true, false).hide();
        audioPlayer?.stopPlaying();
        audioPlayer = null;
        slideSchedule(() => window.location.reload(), 3000);
        return;
    }
    slideLength = slideFlavor.order[idx].slideDelay;
    nidx = idx + 1;
    currentProgram = slidePrograms[slideFlavor.order[idx].function];
    currentDiv = slideDivs[slideFlavor.order[idx].function];
    nextProgram = slidePrograms[slideFlavor.order[nidx]?.function];
    nextDiv = slideDivs[slideFlavor.order[nidx]?.function];
    currentProgram();
}
