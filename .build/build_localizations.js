"use strict";

var fs      = require('fs'),
    request = require('request'),
    url     = require('url'),
    http    = require('http'),
    sys     = require('sys'),
    // get this url when you publish spreadshit as a web page
    // don't forget to change url to &alt=json
    url_cells   = 'http://spreadsheets.google.com/feeds/cells/0AnKM3pt9NTuCdDRVYjRpQnd4b3ZNMlR6enJVWDhpRXc/od6/public/basic?authkey=CL7mmYkL&alt=json';
    
    // skip path to js and script
    var PARAMS = process.argv.splice(2);

    if (!PARAMS[0]) {
        sys.puts('Run this script with path to put localizations');
    } else {
        fetchURI(url_cells, parseGoogleDocs);
    }

// from http://code.google.com/chrome/webstore/docs/i18n.html#localeTable
var supported_localizations = {
    'Chtulhu': 'cht',
    'Arabic': 'ar',
    'Bulgarian': 'bg',
    'Catalan': 'ca',
    'Czech': 'cs',
    'Danish': 'da',
    'German': 'de',
    'Greek': 'el',
    'English': 'en',
    'English (Great Britain)': 'en_GB',
    'English (USA)': 'en_US',
    'Spanish': 'es',
    'es_419': 'Spanish (Latin America and Caribbean)',
    'Estonian': 'et',
    'Finnish': 'fi',
    'Filipino': 'fil',
    'French': 'fr',
    'Hebrew': 'he',
    'Hindi': 'hi',
    'Croatian': 'hr',
    'Hungarian': 'hu',
    'Indonesian': 'id',
    'Italian': 'it',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Lithuanian': 'lt',
    'Latvian': 'lv',
    'Dutch': 'nl',
    'Norwegian': 'no',
    'Polish': 'pl',
    'Portuguese (Brazil)': 'pt_BR',
    'Portuguese (Portugal)': 'pt_PT',
    'Romanian': 'ro',
    'Russian': 'ru',
    'Slovak': 'sk',
    'Slovenian': 'sl',
    'Serbian': 'sr',
    'Swedish': 'sv',
    'Thai': 'th',
    'Turkish': 'tr',
    'Ukrainian': 'uk',
    'Vietnamese': 'vi',
    'Chinese (China)': 'zh_CN',
    'Chinese (Taiwan)': 'zh_TW'
};

function fetchURI(someUri, callback) {
    request({uri: someUri}, function (error, response, data) {
        callback(data);
    });
}

function parseGoogleDocs(feed) {

    try {
        feed = eval('('+feed+')');
    } catch(e) {
        sys.puts('Feed is probably not a well formed JSON');
        sys.puts(e);
        return 1;
    }

    var data      = {};
    var cols_dict = {};

    for (var i = 0, max = feed.feed.entry.length; i < max; i++) {
        var cell = feed.feed.entry[i];
        // UGLY UGLY UGLY
        var number = cell.title['$t'].split(/\D/); number = number[1];
        var letter = cell.title['$t'].split(/\d/); letter = letter[0];

        cols_dict[letter] = 1;
        if (!data[letter]) {
            data[letter] = {};
        }
        data[letter][number] = cell.content['$t'];
    }
    var cols_sorted = Object.keys(cols_dict).sort();


    for (var i = 1, max = cols_sorted.length; i < max; i++) {
        var lang = data[cols_sorted[i]][1];
        if (!supported_localizations[lang]) {
            sys.puts('LANG '+lang+' isn\'t supported. Skipping')
            continue;
        }
        // localization file creating

        var result     = {};
        var rows       = Object.keys(data[cols_sorted[i]]).sort();
        var total_rows = Object.keys(data[cols_sorted[0]]).length;

        for (var j = 2, rowsmax = rows.length; j < rowsmax; j++) {
            var string_id   = data[cols_sorted[0]][j];
        	string_id   = string_id.replace(/\s/g, '');
            var string_val  = data[cols_sorted[i]][j];
            
            result[string_id] = {
                'message': string_val
            };
        }

        if (Object.keys(result).length+2 < total_rows) {
            sys.puts('Warning! Language '+lang+' is incomplete and would not be bilded');
            continue;
        } else {
            var path = PARAMS[0];
            fs.mkdir(path+'/_locales/', 448);
            fs.mkdir(path+'/_locales/'+supported_localizations[lang], 448);
            // writing resource to file
            fs.writeFileSync(path+"/_locales/"+supported_localizations[lang]+"/messages.json", JSON.stringify(result), encoding='utf8');
        }
    }

    return 1;
}

