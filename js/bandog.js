var Bandog = {

    version : -1,

    Init: function(ver) {
        Bandog.version = ver;

        // initializing urls
        Bandog.Urls.Init();

        // init translations
        Bandog.UI.DrawTranslations();

        Bandog.Messages.History.Init();

        Bandog.Contacts.Get();
    },

    UI: {
        body: document.getElementById('body'),


        Close: function() {
            //_gaq.push(['_trackEvent', 'Menu CLOSE', 'clicked']);
            window.close();
        },

        DrawTranslations: function() {
            document.getElementById('loading').innerHTML = chrome.i18n.getMessage('loading');
            document.getElementById('nm_send_btn').value = chrome.i18n.getMessage('_ui_send_btn');
            document.getElementById('contacts_header_title').innerHTML = chrome.i18n.getMessage('_ui_contacts_header');
        
            document.getElementById('nw_rcpt_label').innerHTML = chrome.i18n.getMessage('_ui_nw_rcpt_label');
            document.getElementById('nw_text_label').innerHTML = chrome.i18n.getMessage('_ui_nw_text_label');
            document.getElementById('header').innerHTML        = chrome.i18n.getMessage('_ui_header');        
        },

        Load: function() {
            console.log('... UI.Load() started');
            jQuery("#loading").hide();

            document.getElementById('loading').innerHTML = 'Check complete. UI can be loaded';
            
            Bandog.Contacts.DrawUI(Bandog.Contacts.list);

            $('#contacts_sort').bind('keyup', function(){
                Bandog.Contacts.Filter(this.value);
            });

            $('#nm_send_btn').bind('click', function(){
                Bandog.Messages.New.Send();
            });

            console.log('... UI.Load() finished');
            return 1;
        }
        
        
    },

    Messages: {
        // this holds last 50 messages history 
        History: {
            items: [],

            Save: function(rcpt, text, key) {
                Bandog.Messages.History.items.push({
                    'rcpt'          : rcpt,
                    'text'          : text,
                    'timestamp'     : new Date().getTime(),
                    'collapsekey'   : key
                });

                window.localStorage.removeItem('bandog_history');
                window.localStorage.setItem('bandog_history',  JSON.stringify(Bandog.Messages.History.items));
                Bandog.Messages.History.DrawTotal();
            },

            DrawTotal: function() {
                // set proper header
                document.getElementById('history_header').innerHTML =
                    chrome.i18n.getMessage('_history_header')+' ('+Bandog.Messages.History.items.length+')';
            },

            Init: function() {
                // get history from localstorage
                var history = window.localStorage.getItem('bandog_history');
                Bandog.Messages.History.items = (history)
                    ? JSON.parse(history)
                    : [];

                Bandog.Messages.History.DrawTotal();
                
                $('#history_header').bind('click', function(){
                    Bandog.Messages.History.Show();
                });
            },

            Show: function() {
                var self = $('#history');

                if (self.is(':visible')) {
                    self.slideUp();
                    $('#newmessage').slideDown();
                    return 1;
                }

                self.html('');
                // showing history
                var items = Bandog.Messages.History.items;
                for (var i = items.length-1; i >= 0 ; i--) {
                    var item = $('<div class="history_item"></div>')
                        .append(
                            $('<div class="history_date"></div>')
                                .append(items[i].timestamp)
                        )
                        .append(
                            $('<div class="history_rcpt"></div>')
                                .append(items[i].rcpt)
                        )
                        .append(
                            $('<div class="history_text"></div>')
                                .append(items[i].text)
                        );
                    self.append(item);
                }

                $('#newmessage').slideUp();
                self.slideDown();
            }
        },

        New: {
            rcpt: [],

            RedrawRcpt: function() {
                var rcpt_holder = $('#contact_recipients');
                rcpt_holder.hide().html('');

                var recipients  = Bandog.Messages.New.rcpt;
                for (var r = 0; r < recipients.length; r++) {

                    var arr_id = Bandog.Contacts.FindById(recipients[r]);

                    var rcpt = $('<div class="rcpt"></div>')
                        .append('<div class="rcpt_name">'+Bandog.Contacts.list[arr_id].name+'</div>')
                        .append(
                            $('<div class="rcpt_del"><img src="img/blank.png" alt=""/></div>').bind('click', {cid: recipients[r]}, function(event){
                                Bandog.Messages.New.RemoveRcpt(event.data.cid);
                            })
                        );
                    rcpt_holder.append(rcpt);
                }
                rcpt_holder.show();
            },
            
            AddRcpt: function(cid) {
                console.log('Adding rcpt '+cid);
                Bandog.Messages.New.rcpt.push(cid);
                Bandog.Messages.New.RedrawRcpt();
            },

            RemoveRcpt: function(cid) {
                console.log('Removing rcpt '+cid);
                var index = Bandog.Messages.New.rcpt.indexOf(cid);
                if (index != -1) Bandog.Messages.New.rcpt.splice(index, 1);
                Bandog.Messages.New.RedrawRcpt();
            },
            
            Send: function() {
                var phones = [];

                var rcpts = Bandog.Messages.New.rcpt;
                for (var i = 0; i < rcpts.length; i++) {
                    phones.push(Bandog.Contacts.list[Bandog.Contacts.FindById(rcpts[i])].phones[0].number);
                }

                var to      = $('#nm_to_value').val().replace(/\s/g, '');
                if (to == '' && phones.length == 0) {
                    alert('Hey! Add some recipients');
                    return false;
                } else {
                    if (to != '') phones.push(to);
                }

                var text    = $('#nm_text_value').val().trim();
                if (text == '') {
                    alert('Hey Hey Hey! Write some text');
                    return false;
                }

                var rnd_str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

                for (var p = 0; p < phones.length; p++) {
                    var phone_number = phones[p];
                    
                    var collapse_key = new Date().getTime()/1000+
                        rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))+
                        rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))

                    var initial_url = Bandog.Urls.send+
                        '&collapse_key='+collapse_key+
                        '&phone_number='+phone_number+
                        '&message='+encodeURIComponent(text)

                    Bandog.Messages.History.Save(phone_number, text, collapse_key);
                    alert('SENT');
                    //continue;

                    jQuery.ajax({
                        url: initial_url,
                        dataType: 'json',
                        complete: function(data) {
                            console.log(data);
                        }
                    });
                }

                return 1;
            }
        }
    },

    Contacts: {
        list: [],
        
        FindById: function(id) {
            var list = Bandog.Contacts.list;
            for (var i = 0; i < list.length; i++) {
                if (list[i].id == id) {
                    return i;
                }
            }
        },

        Filter: function(name_part) {

            // don't do filtering with empty strings
            if (!/\S/.test(name_part)) {
                Bandog.Contacts.DrawUI(Bandog.Contacts.list);
                return 1;
            }

            var list = Bandog.Contacts.list;
            var res  = [];

            for (var i = 0; i < list.length; i++) {
                if (list[i].name.indexOf(name_part) != -1) {
                    var el  = new cloneObject(list[i]);
                    el.name = el.name.replace(name_part, '<u>'+name_part+'</u>');
                    res.push(el);
                }
            }

            if (res.length > 0) {
                Bandog.Contacts.DrawUI(res);
            } else {
                $('#contacts_list').html(chrome.i18n.getMessage('_ui_no_contacts_math_filtering'));
            }

            
            return 1;
        },

        // type could be 'name' or 'secondname'
        Sort: function(type) {
            if (type == 'name') {
                return Bandog.Contacts.list.sort(function(a,b){
                    if (a.name < b.name) return -1;
                    if (a.name > b.name) return 1;
                    return 0;
                });
            }
        },

        Get: function() {
            console.log('... Contacts Get() sending request');

            var cache = window.localStorage.getItem('bandog_contacts_cache');
            if (cache) {
                cache = JSON.parse(cache);
                if (cache.timestamp && new Date().getTime()/1000 - cache.timestamp < 600) {
                    console.log('Contacts list taken from cache');
                    Bandog.Contacts.list = cache.list;
                    Bandog.Contacts.list = Bandog.Contacts.Sort('name');
                    Bandog.UI.Load();
                    return 1;
                } else {
                    console.warn(cache);
                }
            }

            jQuery.ajax({
                url: Bandog.Urls.contacts,
                dataType: 'json',
                complete: function(data) {
                    var json = {};

                    try {
                        json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                    } catch (err) {
                        console.warn(err);
                        return false;
                    }

                    console.log('... Auth Contacts Get()  status = '+ json.status);
                    if (json.status == "OK") {
                        // caching result for 5 min
                        var cache = {
                            timestamp   : new Date().getTime()/1000,
                            list        : json.contact_list
                        };

                        window.localStorage.removeItem('bandog_contacts_cache');
                        window.localStorage.setItem('bandog_contacts_cache',  JSON.stringify(cache));

                        // now we can load full UI
                        Bandog.Contacts.list = json.contact_list;
                        Bandog.Contacts.list = Bandog.Contacts.Sort('name');
                        Bandog.UI.Load();
                        return 1;
                    }

                    if (json.status == "SIGNIN_REQUIRED") {
                        window.location.href = Bandog.Urls.signIn;
                        return 1;
                    }
                },

                error: function(data, e) {
                    console.warn('unknown status');
                    console.warn(e);
                    console.warn(data);
                    return 0;
                }
            });
        },

        DrawUI: function(list) {
            //contacts
            var holder = $('<ul></ul>');

            for (var i = 0; i < list.length; i++) {
                var avatar = (list[i].avatar) ? list[i].avatar : 'img/noavatar.gif';
                var li = $('<li></li>')
                    .bind('click', {cid: list[i].id}, function(event){
                        var self = $(this);
                        self.toggleClass('selected');
                        if (self.hasClass('selected')) {
                            Bandog.Messages.New.AddRcpt(event.data.cid);
                        } else {
                            Bandog.Messages.New.RemoveRcpt(event.data.cid);
                        }
                    })
                    .append(
                        '<div class="contact_avatar"><img src="'+avatar+'" alt=""></div>\
                        <div class="contact_name">'+list[i].name+'</div>'
                    );
                holder.append(li);
            }

            $('#contacts_list')
                .html('')
                .append(holder);
        }
    },

    Urls: {
        appEngine   : false,
        signIn      : false,
        signOut     : false,
        contacts    : false,
        send        : false,
        index       : chrome.extension.getURL('index.html'),

        Init: function() {
            console.log('... Urls.Init() started');
            Bandog.Urls.appEngine = "http://"+Bandog.version+".latest.bandog812.appspot.com/";
            Bandog.Urls.signIn    = Bandog.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(Bandog.Urls.index)+"&ver="+Bandog.version;
            Bandog.Urls.signOut   = Bandog.Urls.appEngine+"sign?action=signout&extret=OK&ver="+Bandog.version;
            Bandog.Urls.contacts  = Bandog.Urls.appEngine+"dispatcher?action=get_contacts_list&ver="+Bandog.version;
            Bandog.Urls.send  = Bandog.Urls.appEngine+"dispatcher?action=send_message&ver="+Bandog.version;
            console.log('... Urls.Init() finished');
        }
    }
}

function cloneObject(source) {
    for (i in source) {
        if (typeof source[i] == 'source') {
            this[i] = new cloneObject(source[i]);
        }
        else{
            this[i] = source[i];
        }
    }
}