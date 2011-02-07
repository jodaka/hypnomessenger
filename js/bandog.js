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
            
            $('#nm_text_value').bind('change', function(){
                Bandog.Messages.New.RedrawNotes();
            });
            $('#nm_text_value').bind('keyup', function(){
                Bandog.Messages.New.RedrawNotes();
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

            RedrawNotes: function() {
                // count number of symbols in textarea
                var text = $('#nm_text_value').val().trim();

                var text_length = 0;
                for (var i = 0, n = text.length; i < n; i++) {
                    if (text[i].charCodeAt() > 255) {
                        text_length = text_length+2;
                    } else {
                        text_length++;
                    }
                }

                var note1 = 'Message length: '+text_length+' symbols <br />';

                var sms_count = Math.ceil(text_length / 140);
                var note2 = 'Messages to sent: '+sms_count*Bandog.Messages.New.rcpt.length;
                $('#nm_notes').html(note1+note2);
            },

            RedrawRcpt: function() {
                var rcpt_holder = $('#contact_recipients');
                rcpt_holder.hide().html('');

                var recipients  = Bandog.Messages.New.rcpt;
                console.log(recipients);
                
                var rcpt_tmpl = '<div class="rcpt">\
                                        <div class="rcpt_data">\
                                            <div class="rcpt_name">${name}</div>\
                                            <div class="rcpt_phone">${phone}</div>\
                                        </div>\
                                        <div class="rcpt_del"><img src="img/blank.png" alt=""/></div>\
                                    </div>';
                
                for (var r = 0; r < recipients.length; r++) {

                    // filling template with data
                    var rcpt = jQuery.tmpl(rcpt_tmpl, {
                        name    : Bandog.Contacts.list[Bandog.Contacts.FindById(recipients[r].id)].name,
                        phone   : recipients[r].phone
                    });

                    // binding removing client
                    $('div.rcpt_del', rcpt).bind('click', {cid: recipients[r].id}, function(event){
                        Bandog.Messages.New.RemoveRcpt(event.data.cid);
                    });

                    // binding number changing
                    $('div.rcpt_phone', rcpt).bind('click', {id: r, phone: recipients[r].phone, cid: recipients[r].id}, function(event){
                        Bandog.Messages.New.ChangePhone(this, event.data.id, event.data.cid, event.data.phone);
                    });

                    rcpt_holder.append(rcpt);
                }
                rcpt_holder.show();
            },
            
            ChangePhone: function(rcpt_div, id, cid, phone) {
                var $rcpt_div = $(rcpt_div);
                var pos       = $rcpt_div.position();

                var pselect = Bandog.Messages.New.rcpt[id].change;
                // changing number for contact with primary number
                
                $('div.number_change').remove();
                
                var select = $('<div class="number_change"></div>');
                var phones = Bandog.Contacts.list[Bandog.Contacts.FindById(cid)].phones;
                for (var i = 0, max = phones.length; i < max; i++) {
                    select.append(
                        $('<div class="phone"></div>')
                            .append(
                                phones[i].number
                            )
                            .bind('click', {id: id, phone: phones[i].number}, function(event){
                                console.warn('SELECTED id='+event.data.id+ ' phone='+event.data.phone);
                                Bandog.Messages.New.rcpt[event.data.id].phone = event.data.phone;
                                $('div.number_change').remove();
                                Bandog.Messages.New.RedrawRcpt();
                            })
                    );
                }
                $(body).append(select);
                select.css({
                    top     : pos.top+$rcpt_div.height()+'px',
                    left    : pos.left+'px'
                });
                Bandog.Messages.New.rcpt[id].change = select;

                console.log("changing phone for cid = "+id+" phone = "+phone);
                return 1;
            },
            
            AddRcpt: function(cid) {
                console.log('Adding rcpt '+cid);
                var phones = Bandog.Contacts.list[Bandog.Contacts.FindById(cid)].phones;
                if (phones.length > 1) {
                    var primary_number = false;
                    for (var i = 0, max = phones.length; i < max; i++) {
                        if (phones[i].primary) primary_number = phones[i].number;
                    }

                    if (!primary_number) {
                        Bandog.Messages.New.rcpt.push({
                            id      : cid,
                            phone   : 'click to sel',
                            change  : 1
                        });
                    }

                } else {
                    Bandog.Messages.New.rcpt.push({
                        id      : cid,
                        phone   : phones[0].number,
                        change  : 0
                    });
                }

                Bandog.Messages.New.RedrawRcpt();
                Bandog.Messages.New.RedrawNotes()
            },

            RemoveRcpt: function(cid) {
                console.log('Removing rcpt '+cid);
                var rcpts = Bandog.Messages.New.rcpt;
                for (var i = 0, max = rcpts.length; i < max; i++) {
                    if (rcpts[i].id == cid) {
                        Bandog.Messages.New.rcpt.splice(i, 1);
                        break;
                    }
                }
                //var index = Bandog.Messages.New.rcpt.indexOf(cid);
                //if (index != -1) Bandog.Messages.New.rcpt.splice(index, 1);
                Bandog.Messages.New.RedrawRcpt();
                Bandog.Messages.New.RedrawNotes()
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
                    continue;

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
            Bandog.Urls.appEngine   = "http://"+Bandog.version+".latest.bandog812.appspot.com/";
            Bandog.Urls.signIn      = Bandog.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(Bandog.Urls.index)+"&ver="+Bandog.version;
            Bandog.Urls.signOut     = Bandog.Urls.appEngine+"sign?action=signout&extret=OK&ver="+Bandog.version;
            Bandog.Urls.contacts    = Bandog.Urls.appEngine+"contacts_list?action=get&ver="+Bandog.version;
            Bandog.Urls.send        = Bandog.Urls.appEngine+"message?action=send&ver="+Bandog.version;
            Bandog.Urls.send_status = Bandog.Urls.appEngine+"message?action=get_send&ver="+Bandog.version;
            Bandog.Urls.messages_get= Bandog.Urls.appEngine+"sms?action=get&ver="+Bandog.version;
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