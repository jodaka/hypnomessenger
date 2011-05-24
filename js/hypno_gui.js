"use strict";
var bg = chrome.extension.getBackgroundPage();
var HypnoToad = {
    version : -1,

    Init: function(ver) {
        HypnoToad.version = ver;
        
        // send request to background page
        chrome.extension.sendRequest({action: 'checkAuthReg'});

        // draw loading
        HypnoToad.UI.DrawLoading();

        // initializing urls
        HypnoToad.Urls.Init();

        // init translations
        HypnoToad.UI.DrawTranslations();

        // add listener to communicate with popup page
        chrome.extension.onRequest.addListener(
            function(request, sender, sendResponse) {
                bg.console.log('UI: ~~~~~> GUI got signal'+request['action']);
                if (request['action'] == 'reload_lists') {
                    HypnoToad.Messages.Load();
                }
                if (request['action'] == 'reload_contacts') {
                    HypnoToad.Contacts.Load();
                }
                if (request['action'] == 'reload_messages') {
                    HypnoToad.Contacts.Load();
                }
                if (request['action'] == 'not_registered') {
                    HypnoToad.UI.DrawNotRegistered();
                }
                if (request['action'] == 'registered') {
                    HypnoToad.UI.DrawRegistered();
                }
            }
        );

        var status = window.localStorage.getItem('Hypno_status');
        switch (status) {
            case 'device_not_registered':
                bg.console.error('UI: DEV NOT REGISTERED CATCHED');
                HypnoToad.UI.DrawNotRegistered();
                return 1;
            break;
            
            case 'auth':
                chrome.tabs.create({
                    'url': HypnoToad.Urls.signIn
                });
                window.close();
                return 1;
            break;
            default:
                bg.console.log('UI: all is fine');
            break;
        }
        
        window.addEventListener("unload", function (event) {
            HypnoToad.Messages.Draft.Save();
        }, true);

        // reading sms drafts
        var drafts = window.localStorage.getItem('hypno_drafts');
        if (drafts) {
            HypnoToad.Messages.drafts = JSON.parse(drafts);
        }

        // get contacts list
        HypnoToad.Contacts.Init();

        HypnoToad.Messages.Init();
    },

    UI: {
        section : 'new',
        // real man prefer quick access to body ^^
        body     : document.getElementById('body'),
        // flag that shows that numbers dropdown menu is active
        select_number_active: false,

        SelectNumber: function(cid) {
            if (HypnoToad.UI.select_number_active) return false;

            HypnoToad.UI.select_number_active = true;
            var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)];
            var phones  = [];
            
            var list_select = $('<ul></ul>');
            for (var i = contact.phones.length-1; i >= 0; i--) {
                list_select.append(
                    $('<li></li>')
                    .append(contact.phones[i].number)
                    .bind('click', {phone: contact.phones[i].number}, function(e){
                        HypnoToad.Messages.New.reply_number = e.data.phone;
                        $('#user_phones').html(e.data.phone);
                        $('#phones_select').remove();
                        HypnoToad.UI.select_number_active = false;
                    })
                );
            }
            var phones_select = $('<div id="phones_select"></div>')
                .append(list_select);
            $('body').append(phones_select);
        },

        Close: function() {
            window.close();
        },

        CloseInfo: function() {
            HypnoToad.Contacts.info_data.from = [];
            HypnoToad.Messages.Draft.Save();
            if (HypnoToad.Contacts.info_reload_timer) {
                clearInterval(HypnoToad.Contacts.info_reload_timer);
            }
            HypnoToad.UI.Show('history');
            $('#contacts_list li.selected').removeClass('selected');
        },

        Status: function(text){

            if (!text || text == '') {
                $('#status').remove();
                return 1;
            }
    
            if ($('#status').length > 0) {
                $('#status').html(text);
            } else {
                $('body').append($('<div id="status">'+text+'</div>'));
            }
    
            // clear status after timeout
            setTimeout(function(){
                HypnoToad.UI.Status();
            }, 2000);
        },
        
        DrawNew: function() {
            $('#h2_history').html(
                jQuery.tmpl('${new_label} ${got_new_messages}', {
                    history_label       : chrome.i18n.getMessage('history'),
                    new_label           : chrome.i18n.getMessage('new'),
                    got_new_messages    : HypnoToad.Messages.list.incoming.length
                })
            );
        },

        DrawLoading: function() {
            document.getElementById('loading').innerHTML = chrome.i18n.getMessage('_ui_loading');
            return 1;
        },

        DrawRegistered: function() {
            //HypnoToad.Init(HypnoToad.version);
            HypnoToad.Contacts.Init();
            HypnoToad.Messages.Init();
            $('#loading').hide();
        },
        DrawNotRegistered: function() {
            var loading = $('#loading');
            loading.show().html('<h2>'+chrome.i18n.getMessage('_ui_device_not_registered_header')+'</h2>\
                                <div class="dnr">'+chrome.i18n.getMessage('_ui_device_not_registered_text')+'</div>');
        },

        DrawTranslations: function() {
            document.getElementById('contacts_header_title').innerHTML = chrome.i18n.getMessage('_ui_contacts_header');

        },
        
        Show: function(section, data) {
            bg.console.log('UI: == Show('+section+','+data+') ');
            if (section == HypnoToad.UI.section) return 1;
            
            //if (section != 'user' && $('#contact').is(":visible")) {
            //    //HypnoToad.Contacts.CloseInfo();
            //    $('#contact').hide();
            //    $('#contacts').show();
            //}

            HypnoToad.UI.section = section;

            switch (section) {

                case 'history':
                    $('#main div.section:visible').fadeOut('fast', 0, function(){
                        $('#history').show();
                        $('#menu div.active_h2').removeClass('active_h2');
                        $('#h2_history').addClass('active_h2');
                        HypnoToad.Messages.Incoming.Draw('history');
                    });
                break;

                case 'user':
                    //$('#contacts').hide();
                    $('#main div.section:visible').fadeOut('fast', 0, function(){
                        //$('#user').show();
                        $('#menu div.active_h2').removeClass('active_h2');
                        HypnoToad.Contacts.Info(data);
                    });
                break;
            }
        },

        Load: function() {
            // remove loading screen
            $('#loading').hide();

            bg.console.log('UI: ... UI.Load() started');
            HypnoToad.Contacts.Filter();
            //HypnoToad.Contacts.DrawUI(HypnoToad.Contacts.list);

            $('#contacts_sort').bind('keyup', function(){
                HypnoToad.Contacts.Filter(this.value);
            });

            $('#signout').bind('click', function(){
                chrome.extension.sendRequest({action: 'signout'});
                chrome.tabs.create({url: HypnoToad.Urls.signOut});
                window.close();
            });

            // bind menu
            $('#menu div').bind('click', function(){
                HypnoToad.UI.Show(this.id.replace('h2_', ''));
            });

            //HypnoToad.Messages.New.RedrawNotes();
            bg.console.log('UI: ... UI.Load() finished');
            return 1;
        
           
        }
    },

    Notifications: {
        UpdateIcon: function() {
            if (HypnoToad.Messages.list.incoming.length > 0) {
                chrome.browserAction.setBadgeText({text: String(HypnoToad.Messages.list.incoming.length)})
            } else {
                chrome.browserAction.setBadgeText({text: ''});
            }
        }
    },

    Messages: {
        drafts: {},
        
        list : {
            incoming: [],
            outgoing: [],
            viewed  : [],
            history : []
        },

        Draft: {
            text: '',

            Save: function() {
                bg.console.log('UI: Draft saved. Number '+HypnoToad.Messages.New.reply_number+' Text: '+HypnoToad.Messages.Draft.text);
                HypnoToad.Messages.drafts[HypnoToad.Messages.New.reply_number] = HypnoToad.Messages.Draft.text;
                window.localStorage.setItem('hypno_drafts', JSON.stringify(HypnoToad.Messages.drafts));
            },

            Load: function() {
                bg.console.log('UI: draft LOAD');
                var draft = $('#replysms').text();
                if (draft.length == 0 && HypnoToad.Messages.drafts[HypnoToad.Messages.New.reply_number]) {
                    bg.console.log('UI: draft LOADED');
                    $('#replysms').text(HypnoToad.Messages.drafts[HypnoToad.Messages.New.reply_number]);
                }
            }
        },

        RemoveById: function(id, list, copy2list) {
            var obj;
            for (var i = 0; i < list.length; i++) {
                if (list[i].hasOwnProperty(id)) {
                    if (list[i].id == id) {
                        obj = list[i];
                        if (copy2list) push.copy2list(obj);
                        list.splice(i, 1);
                        break;
                    }
                }
            }
        },

        Init: function() {
            HypnoToad.Messages.Load();
            //HypnoToad.Messages.Outgoing.Init();
            //HypnoToad.Messages.New.Init();
            HypnoToad.Messages.Incoming.Draw('history');
        },

        Load: function() {
            var need_redraw = false;
            var local = {
                incoming: [],
                outgoing: [],
                viewed  : [],
                history : []
            };

            local.incoming = window.localStorage.getItem('Hypno_messages_incoming');
            if (local.incoming) {
                HypnoToad.Messages.list.incoming = JSON.parse(local.incoming);
                need_redraw = true;
            }

            local.viewed = window.localStorage.getItem('Hypno_messages_viewed');
            if (local.viewed) {
                HypnoToad.Messages.list.history = JSON.parse(local.viewed);
                need_redraw = true;
            }

            local.history = window.localStorage.getItem('Hypno_messages_history');
            if (local.history) {
                HypnoToad.Messages.list.history = JSON.parse(local.history);
                need_redraw = true;
            }

            if (need_redraw) {
                HypnoToad.UI.DrawNew();
                if (HypnoToad.Messages.list.incoming.length > 0) {
                    bg.console.log('UI: got new messages... redrawing contact list');
                    HypnoToad.Contacts.Filter();
                }
            }
        },

        New: {
            reply_number: '',  // used in send_reply form 
            rcpt: [],

            SendReply: function() {
                bg.console.log('UI: Send Reply called');

                var text    = $('#replysms').text().trim();
                if (text == '') {
                    HypnoToad.UI.Status('Hey Hey Hey! Write some text');
                    return false;
                }

                var rnd_str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
                var collapse_key = new Date().getTime()/1000+
                    rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))+
                    rnd_str.charAt(Math.floor(Math.random() * rnd_str.length));
                var phone_number = HypnoToad.Messages.New.reply_number;
                var send_url = HypnoToad.Urls.send+
                    '&collapse_key='+collapse_key+
                    '&phone_number='+encodeURIComponent(phone_number)+
                    '&message='+encodeURIComponent(text);
                 // disable button
                $('#replysmsbtn').hide();

                var sending_tmpl = '\
                    <div class="history_item me sending">\
                        <div class="history_rcpt">${name}<br /><span class="date"> </span></div>\
                        <div class="history_text">${text}</div>\
                    </div>';

                    $('#contact_history').append(
                        jQuery.tmpl(sending_tmpl, {
                            name: chrome.i18n.getMessage('_me'),
                            text: text
                        })
                    );
                    $("#contact_history").scrollTop($("#contact_history").attr("scrollHeight"));

                jQuery.when(
                    jQuery.ajax({
                        url: send_url,
                        dataType: 'json'
                    })
                ).done(function(ajax){
                    HypnoToad.Messages.Draft.text = ''; // reset draft
                    HypnoToad.Messages.Draft.Save();

                    $('#replysms').keyup();
                    $('#replysmsbtn').show();

                    if (ajax['status'] == 'OK') {

                        $('div.sending').removeClass('sending');
                        $("#contact_history").scrollTop($("#contact_history").attr("scrollHeight"));

                        chrome.extension.sendRequest({
                            action : 'message_sent',
                            message: {
                                'create_time'   : new Date().getTime(),
                                'message'       : text,
                                'collapse_key'  : collapse_key,
                                'phone_number'  : phone_number,
                                'status'        : 0
                            }
                        });

                        $('#replysms').text('');
                    } else {
                        bg.console.error('message NOT sent');
                        bg.console.error(ajax);
                    }
                });
            }

        },

        Incoming: {
            list        : [],
            viewed      : [],
            check_timer : false,

            MarkAndRemove: function(id){
                HypnoToad.Messages.Incoming.MarkAsRead(id);
                HypnoToad.Messages.Incoming.Draw();
            },

            formatTime: function(timestamp) {
                var date      = new Date(timestamp);
                var month     = chrome.i18n.getMessage('_ui_month'+(date.getMonth()+1));
                var fdate     = date.getDate()+' '+month+' <span class="time">'+date.getHours()+':'+date.getMinutes()+'</span>';
                return fdate;
            },

            MarkAsRead: function(id) {
                bg.console.log('UI: Marking as read id='+id);
                jQuery.ajax({
                    url: HypnoToad.Urls.set_status+id,
                    dataType: 'json',
                    complete: function(data) {
                        // actually we should check real response here... but we are lazy
                        HypnoToad.Messages.Incoming.Store();
                    }
                });
                HypnoToad.Messages.RemoveById(id, HypnoToad.Messages.list.incoming, HypnoToad.Messages.list.viewed);
                //HypnoToad.Messages.Incoming.Draw();
                HypnoToad.Notifications.UpdateIcon();
                HypnoToad.Contacts.Filter();
            },

            Draw: function() {

                var list = HypnoToad.Messages.list.incoming;

                $('#history_header').html(chrome.i18n.getMessage('_ui_new_messages'));

                var messages = [];
                if (list.length > 0) {
                    for (var i = 0, max = list.length; i < max; i++) {
                        var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindByPhone(list[i].phone_number)];
                        var message = {
                            'id'    : list[i].id,
                            'class' : (list[i].hasOwnProperty('id')) ? 'notme' : 'me',
                            'date'  : HypnoToad.Messages.Incoming.formatTime(list[i].create_time),
                            'name'  : (contact) ? contact.name : list[i].phone_number,
                            'text'  : list[i].message,
                         'markread' : chrome.i18n.getMessage('_ui_mark_as_read')
                        };
                        messages.push(message);
                    }
    
                    var history_tmpl = '\
                        {{each items}}\
                            <div class="history_item ${$value.class}">\
                                <div class="history_rcpt">${$value.name}<br /><span class="date">{{html $value.date}}</span></div>\
                                <div class="history_text">${$value.text}</div>\
                            </div>\
                        {{/each}}\
                        ';
    
                    $('#history_messages').html('')
                    .append(
                        $('<div id="history_list"></div>').html(
                            jQuery.tmpl(history_tmpl, {
                                items           : messages
                            })
                        )
                    );
                    
                } else {
                    $('#history_messages').html('<div id="nomsg">'+chrome.i18n.getMessage('_no_new_msg')+'</div>');
                }
            },

            LoadViewed: function() {
                var viewed = window.localStorage.getItem('Hypno_messages_viewed');
                if (viewed) {
                    viewed = JSON.parse(viewed);
                    HypnoToad.Messages.list.viewed = viewed;
                    bg.console.log('UI: Viewed messages loaded');
                }
            },

            Store: function() {
                window.localStorage.removeItem('Hypno_messages_viewed');
                window.localStorage.setItem('Hypno_messages_viewed',  JSON.stringify(HypnoToad.Messages.list.viewed));
            }
        },

    },

    Contacts: {
        info_reload_timer: false,
        list: [],
        phones_lookup: false,
        info_data: {
            to: [],
            from: [],
            phones: []
        },
        /*
            Takes contact id and shows a detailed contact info
        */
        Info: function(cid) {
            var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)];
            var phones  = [];
            for (var i = contact.phones.length-1; i >= 0; i--) {
                phones.push(contact.phones[i].number);
            }
            var phones_numbers = phones.join(',');
            HypnoToad.Contacts.info_data.phones = phones;

            var user_tmpl = '\
                <div id="user_header">\
                    <div id="user_name">${user_name}</div>\
                    <div id="user_phones">${user_phone}</div>\
                    <div onclick="HypnoToad.UI.CloseInfo()" id="user_close">&nbsp;</div>\
                </div>\
                <div id="user_messages"><div id="contact_history"></div></div>\
                <div id="reply_holder">\
                    <div id="replysms" contenteditable="true"></div>\
                    <div id="nm_reply">\
                        <div id="reply_sms_count">0 sms</div>\
                        <div id="replysmsbtn" onclick="HypnoToad.Messages.New.SendReply()">${send_reply_label}</div>\
                    </div>\
                </div>\
            ';

            HypnoToad.UI.Status(chrome.i18n.getMessage('_ui_loading'));
            bg.console.log('UI: reply number '+HypnoToad.Messages.New.reply_number);

            $('#user').html('').append(
                jQuery.tmpl(user_tmpl , {
                    user_name   : contact.name,
                    user_phone  : chrome.i18n.getMessage('loading'),
                    send_reply_label: chrome.i18n.getMessage('_send_reply')
                })
            ).show();

            $('#replysms').bind('keyup', function(e){
                var text = $(this).text().trim();
                HypnoToad.Messages.Draft.text = text;

                var text_length = 0;
                for (var i = 0, n = text.length; i < n; i++) {
                    if (text[i].charCodeAt() > 255) {
                        text_length = text_length+2;
                    } else {
                        text_length++;
                    }
                }

                var sms_count  = Math.ceil(text_length / 140);
                var sms_holder = $('#reply_sms_count');
                sms_holder.html(sms_count+' sms');
                if (sms_count > 0) {
                    sms_holder.addClass('mmoresms');
                } else {
                    sms_holder.removeClass('mmoresms');
                }
            });

            var get_data_and_draw_it = function() {
                // Drawing messages
                jQuery.when(
                    jQuery.ajax({
                        url: HypnoToad.Urls.messages.get.unread+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                        dataType: 'json'
                       
                    }),
                    jQuery.ajax({
                        url: HypnoToad.Urls.messages.get.outgoing+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                        dataType: 'json'
                      
                    })
                ).done(function(ajax1, ajax2){
                    HypnoToad.UI.Status();
                    var from = [];
                    var to   = [];
    
                    if (ajax1[1] == 'success') from = ajax1[0].sms_list;
                    if (ajax2[1] == 'success') to   = ajax2[0].message_list;
    
                    // merging of 2 lists
                    for (var t = 0; t < to.length; t++) {
                        for (var f = 0; f < from.length; f++) {
                            if (from[f].create_time > to[t].create_time) {
                                continue;
                            } else {
                                from.splice(f, 0, to[t]);
                                break;
                            }
                        }
                    }

                    // check if we data has anything new
                    if (JSON.stringify(HypnoToad.Contacts.info_data.from) != JSON.stringify(from)) {
                        HypnoToad.Contacts.info_data.from = from;
                    } else {
                        return 0;
                    }

                    HypnoToad.Messages.New.reply_number = '';
                    var messages = [];
                    for (var i = from.length-1; i >= 0; i--) {
                        var message = {
                            'id'    : i,
                            'class' : (from[i].hasOwnProperty('id')) ? 'notme' : 'me',
                            'date'  : HypnoToad.Messages.Incoming.formatTime(from[i].create_time),
                            'name'  : (from[i].hasOwnProperty('id')) ? contact.name : chrome.i18n.getMessage('_me'),
                            'text'  : from[i].message
                        };
                        messages.push(message);
                        if (from[i].hasOwnProperty('id') && from[i].status != 30) {
                            HypnoToad.Messages.Incoming.MarkAsRead(from[i].id);
                        }
                        if (message['class'] == 'notme' && HypnoToad.Messages.New.reply_number == '') {
                            HypnoToad.Messages.New.reply_number = from[i].phone_number;
                        }
                    }

                    var phones_label = $('#user_phones');
                    phones_label.text(HypnoToad.Messages.New.reply_number);
                    // check if there are more then 1 phone number
                    if (HypnoToad.Contacts.info_data.phones.length > 1) {
                        // make something usefull 
                        phones_label.addClass('has_mmore_pphones');

                        phones_label.bind('click', function(e){
                            HypnoToad.UI.SelectNumber(cid);
                        });
                    } 

                    var history_tmpl = '\
                        {{each items}}\
                            <div class="history_item ${$value.class}">\
                                <div class="history_rcpt">${$value.name}<br /><span class="date">{{html $value.date}}</span></div>\
                                <div class="history_text">${$value.text}</div>\
                            </div>\
                        {{/each}}';

                    $('#contact_history').html(
                        jQuery.tmpl(history_tmpl, {
                            items           : messages
                        })
                    );

                    HypnoToad.Messages.Draft.Load();

                    var contact_history = $("#contact_history");
                    contact_history.scrollTop(contact_history.attr("scrollHeight"));
                });
            };
            
            //get_data_and_draw_it
            HypnoToad.Contacts.info_reload_timer = setInterval(function(){
                bg.console.log('UI: ==> reloading chat');
                get_data_and_draw_it();
            }, 10000);
            get_data_and_draw_it();
        },

        FindByPhone: function(phone) {
            var lookup = HypnoToad.Contacts.phones_lookup;
            // if lookup is empty we need to init it first
            if (!lookup) {
                lookup   = {};
                var list = HypnoToad.Contacts.list;
                for (var i = 0; i < list.length; i++) {
                    for (var j = 0; j < list[i].phones.length; j++) {
                        var number = list[i].phones[j].number;
                            number = number.replace(/^\+/, '');
                            number = number.replace(/\s|-/g, '');
                        lookup[number] = i;
                    }
                }
                HypnoToad.Contacts.phones_lookup = lookup;
            }
            if (!phone) return -1;
            phone = phone.replace(/^\+/, '');
            phone = phone.replace(/\s/g, '');
            return lookup[phone];
        },
        FindById: function(id) {
            var list = HypnoToad.Contacts.list;
            for (var i = 0; i < list.length; i++) {
                if (list[i].id == id) {
                    return i;
                }
            }
            return -1;
        },

        Filter: function(name_part) {
            if (!name_part) name_part = $('#contacts_sort').val().trim();
            name_part = name_part.toLowerCase();

            var list = HypnoToad.Contacts.list;
            var res  = [];

            var new_sms_rcpt = {};
            for (var i = 0; i < HypnoToad.Messages.list.incoming.length; i++) {
                var phone   = HypnoToad.Messages.list.incoming[i].phone_number;
                var rcpt_id = HypnoToad.Contacts.FindByPhone(phone);
                if (list[rcpt_id]) {
                    if (new_sms_rcpt[list[rcpt_id].id]) {
                        new_sms_rcpt[list[rcpt_id].id]++;
                    } else {
                        new_sms_rcpt[list[rcpt_id].id] = 1;
                    }
                }
            }

            for (var i in new_sms_rcpt) {
                if (!new_sms_rcpt.hasOwnProperty(i)) continue;
                //if (rcpt_in_new_msg.hasOwnProperty(i)) continue; // skip contacts added to new SMS
                var id      = HypnoToad.Contacts.FindById(i);
                var el      = new cloneObject(list[id]);
                el.new_sms  = new_sms_rcpt[i];
                if (name_part != '') {
                    var index_start = list[id].name.toLowerCase().indexOf(name_part);
                    if (index_start != -1) {
                        el.name = el.name.substring(0, index_start)+'<u>'+el.name.substr(index_start, name_part.length)+'</u>'+el.name.substring(index_start+name_part.length, el.name.length);
                        res.push(el);
                    }
                } else {
                    res.push(el);
                }
            }

            for (var i = 0; i < list.length; i++) {
                // don't show contacts that are already in new message rcpt list
                if (new_sms_rcpt[list[i].id]) continue;

                if (name_part != '') {
                    var index_start = list[i].name.toLowerCase().indexOf(name_part);
                    if (index_start != -1) {
                        var el  = new cloneObject(list[i]);
                        el.name = el.name.substring(0, index_start)+'<u>'+el.name.substr(index_start, name_part.length)+'</u>'+el.name.substring(index_start+name_part.length, el.name.length);
                        res.push(el);
                    }
                } else {
                    res.push(list[i]);
                }
            }

            if (res.length > 0) {
                HypnoToad.Contacts.DrawUI(res);
            } else {
                $('#contacts_list').html(chrome.i18n.getMessage('_ui_no_contacts_math_filtering'));
            }

            return 1;
        },

        // type could be 'name' or 'secondname'
        Sort: function(type) {
            if (type == 'name') {
                return HypnoToad.Contacts.list.sort(function(a,b){
                    if (a.name < b.name) return -1;
                    if (a.name > b.name) return 1;
                    return 0;
                });
            }
        },

        Init: function() {
            HypnoToad.Contacts.Load();
            HypnoToad.UI.Load();
        },

        Load: function() {
            bg.console.log('UI: ... getting Contacts from local storage');
            HypnoToad.Contacts.list = JSON.parse(window.localStorage.getItem('Hypno_contacts'));
            HypnoToad.Contacts.list = HypnoToad.Contacts.Sort('name');
        },

        DrawUI: function(list) {
            //contacts
            var holder = $('<ul></ul>');

            for (var i = 0; i < list.length; i++) {
                var avatar = '<div class="avatar_sms"> </div>';
                // draw number of new messages on avatar
                if (list[i].new_sms) {
                    avatar = $('<div class="avatar_sms">'+list[i].new_sms+'</div>')
                        .bind('click', {cid: list[i].id}, function(event){
                            HypnoToad.UI.Show('user', event.data.cid);
                        });
                }

                var li = $('<li class="contact"></li>')
                    .append(
                        $('<div class="contact_info"></div>')
                            .append(
                                $('<div class="contact_name">'+list[i].name+'</div>')
                                .bind('click', {cid: list[i].id}, function(event){
                                    var parent = $(this).parent().parent();
                                    if (parent.hasClass('selected')) return 0;
                                    
                                    $('#contacts_list li.selected').removeClass('selected');
                                    parent.addClass('selected');
                                    HypnoToad.UI.Show('user', event.data.cid);
                                })
                            )
                            .append(avatar)
                    );
                if (list[i].new_sms) {
                    li.addClass('NewSMS');
                }
                holder.append(li);
            }

            $('#contacts_list')
                .html('')
                .append(holder)
        }
    },

    Urls: {
        appEngine   : false,
        signIn      : false,
        signOut     : false,
        contacts    : false,
        send        : false,
        index       : chrome.extension.getURL('hypno_gui.html'),

        Init: function() {
            HypnoToad.Urls.appEngine   = "http://"+HypnoToad.version+".latest.bandog812.appspot.com/";
            HypnoToad.Urls.signIn      = HypnoToad.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(chrome.extension.getURL('loading.html'))+"&ver="+HypnoToad.version;
            HypnoToad.Urls.signOut     = HypnoToad.Urls.appEngine+"sign?action=signout&extret="+encodeURIComponent(chrome.extension.getURL('close.html'))+"&ver="+HypnoToad.version;
            HypnoToad.Urls.contacts    = HypnoToad.Urls.appEngine+"contacts_list?action=get&ver="+HypnoToad.version;
            HypnoToad.Urls.send        = HypnoToad.Urls.appEngine+"message?action=send&ver="+HypnoToad.version;
            HypnoToad.Urls.send_status = HypnoToad.Urls.appEngine+"message?action=get_status&ver="+HypnoToad.version+'&collapse_key=';

            HypnoToad.Urls.messages = {
                'get': {
                    unread  : HypnoToad.Urls.appEngine+"sms?action=get&ver="+HypnoToad.version,
                    outgoing: HypnoToad.Urls.appEngine+'message?action=get&ver='+HypnoToad.version
                }
            };
            HypnoToad.Urls.set_status  = HypnoToad.Urls.appEngine+"sms?action=update_status&ver="+HypnoToad.version+"&status=30&id=";
        }
    }
}

function cloneObject(source) {
    for (var i in source) {
        if (typeof source[i] == 'source') {
            this[i] = new cloneObject(source[i]);
        }
        else{
            this[i] = source[i];
        }
    }
}