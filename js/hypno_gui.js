"use strict";
var HypnoToad = {
    version : -1,

    // console.log wrapper then only spams in debug mode
    log: function(o) {
        chrome.extension.sendRequest({action: 'bg_log', type: 'info', data: o});
    },
    // HypnoToad.log wrapper then only spams in debug mode
    warn: function(o) {
        chrome.extension.sendRequest({action: 'bg_log', type: 'warn', data: o});
    },
    // HypnoToad.log wrapper then only spams in debug mode
    error: function(o) {
        chrome.extension.sendRequest({action: 'bg_log', type: 'error', data: o});
    },

    Init: function(ver) {
        HypnoToad.version = ver;
        // draw loading
        HypnoToad.UI.DrawLoading();

        // initializing urls
        HypnoToad.Urls.Init();

        // init translations
        HypnoToad.UI.DrawTranslations();

        // Signals processing from BG
        chrome.extension.onRequest.addListener(
            function(request, sender, sendResponse) {
                if (!request.hasOwnProperty('action')) {
                    HypnoToad.log('UI: request without action detected. Ignoring');
                    return false;
                }

                HypnoToad.log('UI: ~~~~~> got signal '+request.action);
                switch(request.action) {

                case 'ui_message_sent':
                    HypnoToad.Messages.New.SendReplyFinished();
                    break;

                case 'ui_reload_contacts':
                    if (HypnoToad.Contacts.Load()){
                        HypnoToad.UI.UpdateContacts();
                    }
                    break;

                case 'ui_reload_messages':
                    if (HypnoToad.Messages.Load()) {
                        HypnoToad.UI.Update();
                    }
                    break;

                case 'ui_not_registered':
                    HypnoToad.UI.DrawNotRegistered();
                    break;

                case 'ui_reload_dialog':
                    HypnoToad.Messages.Load();
                    HypnoToad.UI.DrawDialog(request.cid);
                    break;

                case 'ui_registered':
                    HypnoToad.UI.DrawRegistered();
                    break;
                }
                return true;
            }
        );

        var status = window.localStorage.getItem('Hypno_status');

        switch (status) {
        case 'device_not_registered':
            HypnoToad.error('UI: DEV NOT REGISTERED CATCHED');
            HypnoToad.UI.DrawNotRegistered();
            break;

        case 'auth':
            chrome.tabs.create({
                                   'url': HypnoToad.Urls.signIn
                               });
            window.close();
            break;
        }

        if (status == 'auth') {
            // break when not authorizhed
            return false;
        }

        // saving draft on unload
        window.addEventListener("unload", function (event) {
                                    HypnoToad.Messages.Draft.Save();
                                }, true);

        // reading sms drafts
        var drafts = window.localStorage.getItem('hypno_drafts');
        if (drafts) {
            HypnoToad.Messages.drafts = JSON.parse(drafts);
        }
        HypnoToad.Contacts.Load();
        HypnoToad.Messages.Init();
    },

    UI: {
        section  : 'new',
        // real man prefer quick access to body ^^
        body     : document.getElementById('body'),
        // flag that shows that numbers dropdown menu is active
        select_number_active: false,

        SelectNumber: function(cid) {
            if (HypnoToad.UI.select_number_active) {
                return false;
            }

            HypnoToad.UI.select_number_active = true;
            var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)];
            var phones  = [];

            var list_select = document.createElement('ul');

            var bind_helper = function(phone_number) {
                return function(e) {
                    HypnoToad.Messages.New.reply_number = phone_number;
                    $('#user_phones').html(phone_number);
                    $('#phones_select').remove();
                    HypnoToad.UI.select_number_active = false;
                };
            };

            for (var i = contact.phones.length-1; i >= 0; i--) {
                var li = document.createElement('li');
                li.innerHTML = contact.phones[i].number;
                li.onclick   = bind_helper(contact.phones[i].number);
                list_select.appendChild(li);
            }

            var phones_select = document.createElement('div');
            phones_select.setAttribute('id', 'phones_select');
            phones_select.innerHTML = list_select;
            document.body.appendChild(phones_select);
            return true;
        },

        // this function will redraw contact list and
        // dialog/new messages
        Update: function() {
            if (HypnoToad.Contacts.selected) {
                // we got active
                HypnoToad.UI.DrawDialog(HypnoToad.Contacts.selected);
            } else {
                HypnoToad.UI.DrawNewMessages();
            }
            if (HypnoToad.Contacts.Load()) {
                HypnoToad.Contacts.Filter();
            }
        },

        Close: function() {
            window.close();
        },

        CloseInfo: function() {
            HypnoToad.Messages.Draft.Save();
            HypnoToad.UI.Show('history');
            jQuery('#contacts_list li.selected').removeClass('selected');
            jQuery('#phones_select').remove();       // if phones select exists
            HypnoToad.Contacts.selected = false;

            // send a signal to background to indicate no more dialog is active
            chrome.extension.sendRequest({action: 'bg_dialog_inactive'});
            return true;
        },

        DrawDialog: function(cid) {
            HypnoToad.log('UI: DrawDialog called with cid = '+cid);
            if (!cid || cid == 'undefined') {
                HypnoToad.warn('UI: DrawDialog called with undefined cid');
                return false;
            }

            var contact    = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)],
                dialog     = HypnoToad.Messages.list.dialog,
                messages   = [],
                markedread = [],
                number     = false;

            HypnoToad.Messages.New.reply_number = '';

            for (var i = 0; i < dialog.length; i++) {
                var message = {
                    'id'    : i,
                    'class' : (dialog[i].hasOwnProperty('id')) ? 'notme' : 'me',
                    'date'  : HypnoToad.Messages.formatTime(dialog[i].create_time),
                    'name'  : (dialog[i].hasOwnProperty('id')) ? ((contact) ? contact.name : dialog[i].phone_number) : chrome.i18n.getMessage('_me'),
                    'text'  : dialog[i].message
                };
                // name error ?
                messages.push(message);

                if (dialog[i].hasOwnProperty('id') && dialog[i].status != 30) {
                    markedread.push(dialog[i].id);
                }
                if (message['class'] == 'notme' && HypnoToad.Messages.New.reply_number === '') {
                    HypnoToad.Messages.New.reply_number = dialog[i].phone_number;
                }
            }
            if (markedread.length > 0) {
                HypnoToad.Messages.MarkAsRead(markedread);
            }

            var phones_label = $('#user_phones');
            if (HypnoToad.Messages.New.reply_number) {
                phones_label.text(HypnoToad.Messages.New.reply_number);
            } else {
                // fallback to first number
                HypnoToad.log('~~~ falling back to default number');
                HypnoToad.Messages.New.reply_number = HypnoToad.Contacts.info_data.phones[0];
                phones_label.text(HypnoToad.Contacts.info_data.phones[0]);
            }

            // check if there are more then 1 phone number
            if (HypnoToad.Contacts.info_data.phones.length > 1) {
                // make something usefull
                phones_label.addClass('has_mmore_pphones');
                phones_label.bind('click', function(e){
                    HypnoToad.UI.SelectNumber(cid);
                });
            }

            var contact_history = $("#contact_history");

            var history_tmpl = '\
                {{each items}}\
                    <div class="history_item ${$value.class}">\
                        <div class="history_rcpt">${$value.name}<br /><span class="date">{{html $value.date}}</span></div>\
                        <div class="history_text">${$value.text}</div>\
                    </div>\
                {{/each}}';

            contact_history.hide().html(
                jQuery.tmpl(history_tmpl, {
                    items           : messages
                })
            ).show();
            HypnoToad.Messages.Draft.Load();
            return true;

        },

        // just a wrapper
        UpdateContacts: function (){
            HypnoToad.Contacts.Filter();
        },

        DrawContacts: function (list) {
            if (!list) list = HypnoToad.Contacts.list;

            //contacts
            var holder = $('<ul></ul>');

            for (var i = 0; i < list.length; i++) {

                // draw number of new messages
                var msg_num_icon = (list[i].new_sms)
                    ? '<div class="avatar_sms">'+list[i].new_sms+'</div>'
                    : '<div class="avatar_sms"> </div>';

                var li = $('<li class="contact"></li>')
                    .append(
                        $('<div class="contact_info"></div>')
                            .append(
                                $('<div class="contact_name">'+list[i].name+'</div>')
                                .bind('click', {cid: list[i].id}, function(event){
                                    HypnoToad.UI.SelectUser(event.data.cid);
                                })
                            )
                            .append(msg_num_icon)
                    );
                if (list[i].new_sms) {
                    li.addClass('NewSMS');
                }
                if (list[i].id == HypnoToad.Contacts.selected) {
                    li.addClass('selected');
                }
                holder.append(li);
            }

            $('#contacts_list').html(holder);
        },

        SelectUser: function(id, el) {
            //var parent = $(el).parent().parent();
            //if (parent.hasClass('selected')) return 0;
            if (HypnoToad.Contacts.selected == id) return false; // do nothing if user already selected

            HypnoToad.Contacts.selected = id;

            //$('#contacts_list li.selected').removeClass('selected');
            //parent.addClass('selected');

            HypnoToad.UI.Show('user', id);
            //HypnoToad.UI.DrawContacts();
            HypnoToad.Contacts.Filter();
            return true;
        },

        DrawNewMessages: function() {
            var list = HypnoToad.Messages.list.incoming;

            $('#history_header').html(chrome.i18n.getMessage('_ui_new_messages'));

            var messages = [];
            if (list.length > 0) {
                for (var i = 0, max = list.length; i < max; i++) {
                    var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindByPhone(list[i].phone_number)];
                    messages.push({
                        'id'    : list[i].id,
                        'class' : (list[i].hasOwnProperty('id')) ? 'notme' : 'me',
                        'date'  : HypnoToad.Messages.formatTime(list[i].create_time),
                        'name'  : (contact) ? contact.name : list[i].phone_number,
                        'cid'   : (contact) ? contact.id : 'null',
                        'text'  : list[i].message,
                     'markread' : chrome.i18n.getMessage('_ui_mark_as_read')
                    });
                }

                var history_tmpl = '\
                    {{each items}}\
                        <div class="history_item ${$value.class}" onclick="HypnoToad.UI.SelectUser(\'${$value.cid}\')">\
                            <div class="history_rcpt">${$value.name}<br /><span class="date">{{html $value.date}}</span></div>\
                            <div class="history_text">${$value.text}</div>\
                        </div>\
                    {{/each}}\
                    ';

                $('#history_messages').html(
                    $('<div id="history_list"></div>').html(
                        jQuery.tmpl(history_tmpl, {
                            items           : messages
                        })
                    )
                );

                $('#mark_all_read').html(
                    $('<a href="javascript:void(0)">'+chrome.i18n.getMessage('_ui_mark_all_as_read')+'</a>').click(function(){
                        HypnoToad.log('UI: Mark all messages as read');
                        chrome.extension.sendRequest({action: 'bg_mark_as_read', data: 'all'});
                    })
                );

            } else {
                $('#history_messages').html('<div id="nomsg">'+chrome.i18n.getMessage('_no_new_msg')+'</div>');
                $('#mark_all_read').html('');
            }
        },

        DrawLoading: function () {
            document.getElementById('loading').innerHTML = chrome.i18n.getMessage('_ui_loading');
            return 1;
        },

        DrawRegistered: function () {
            $('#loading').hide().html();
            HypnoToad.Messages.Init();
        },

        // template that is being showed when android app isn't registered
        DrawNotRegistered: function() {
            var not_registered_tmpl = '<div id="loading_center">\
                <div id="not_registered">\
                    <h2><img src="img/icon_120.png" alt="" align="middle"> ${not_registered_h2}</h2>\
                    <p>${not_registered_text}</p>\
                </div>\
            </div>';

            $('#loading').html(
                jQuery.tmpl(not_registered_tmpl,{
                                not_registered_h2   : chrome.i18n.getMessage('_ui_device_not_registered_header'),
                                not_registered_text : chrome.i18n.getMessage('_ui_device_not_registered_text')
                            })
            ).show();
        },

        DrawTranslations: function() {
            document.getElementById('contacts_header_title').innerHTML = chrome.i18n.getMessage('_ui_contacts_header');

        },

        Show: function (section, data) {
            HypnoToad.log('UI: == Show('+section+','+data+') ');
            HypnoToad.UI.section = section;

            switch (section) {

            case 'history':
                $('#main div.section:visible').fadeOut('fast', 0, function(){
                                                           $('#history').show();
                                                           $('#menu div.active_h2').removeClass('active_h2');
                                                           $('#h2_history').addClass('active_h2');
                                                           HypnoToad.UI.DrawNewMessages();
                                                       });
                break;

            case 'user':
                $('#main div.section:visible').fadeOut('fast', 0, function(){
                                                           $('#menu div.active_h2').removeClass('active_h2');
                                                           HypnoToad.Contacts.Info(data);
                                                       });
                break;
            }
        },

        Load: function() {
            // remove loading screen
            $('#loading').hide();

//            HypnoToad.log('UI: ... UI.Load() started');
            HypnoToad.Contacts.Filter();

            $('#contacts_sort').bind('keyup', function(){
                HypnoToad.Contacts.Filter(this.value);
            });

            $('#signout').bind('click', function(){
                chrome.extension.sendRequest({action: 'bg_signout'});
                chrome.tabs.create({url: HypnoToad.Urls.signOut});
                window.close();
            });

            // bind menu
            $('#menu div').bind('click', function(){
                HypnoToad.UI.Show(this.id.replace('h2_', ''));
            });

            //HypnoToad.Messages.New.RedrawNotes();
//            HypnoToad.log('UI: ... UI.Load() finished');
            return true;
        }
    },


    Messages: {
        drafts: {},

        list : {
            incoming: [],
            outgoing: [],
            viewed  : [],
            history : [],
            dialog  : []
        },

        Draft: {
            text: '',

            Save: function() {
//                HypnoToad.log('UI: Draft saved. Number '+HypnoToad.Messages.New.reply_number+' Text: '+HypnoToad.Messages.Draft.text);
                HypnoToad.Messages.drafts[HypnoToad.Messages.New.reply_number] = HypnoToad.Messages.Draft.text;
                window.localStorage.setItem('hypno_drafts', JSON.stringify(HypnoToad.Messages.drafts));
            },

            Load: function() {
                //HypnoToad.log('UI: draft LOAD');
                var draft = $('#replysms').text();
                if (draft.length == 0 && HypnoToad.Messages.drafts[HypnoToad.Messages.New.reply_number]) {
                    HypnoToad.log('UI: draft LOADED');
                    $('#replysms').text(HypnoToad.Messages.drafts[HypnoToad.Messages.New.reply_number]);
                }
            }
        },

        Init: function() {
            HypnoToad.Messages.Load();
            HypnoToad.UI.DrawNewMessages();
            HypnoToad.UI.Load(); // draw contact list
        },

        Load: function() {
            var need_redraw = false;
            var local = {
                incoming: [],
                viewed  : [],
                dialog  : []
            };

            // new messages
            local.incoming = window.localStorage.getItem('Hypno_messages_incoming');
            if (local.incoming) {
                if (JSON.stringify(HypnoToad.Messages.list.incoming) != local.incoming) {
                    HypnoToad.Messages.list.incoming = JSON.parse(local.incoming);
                    need_redraw = true;
                }
            }

            // viewed
            local.viewed = window.localStorage.getItem('Hypno_messages_viewed');
            if (local.viewed) {
                if (JSON.stringify(HypnoToad.Messages.list.viewed) != local.viewed) {
                    HypnoToad.Messages.list.viewed= JSON.parse(local.viewed);
                    need_redraw = true;
                }
            }

            // dialog
            local.dialog = window.localStorage.getItem('Hypno_dialog');
            if (local.dialog) {
                if (JSON.stringify(HypnoToad.Messages.list.dialog) != local.dialog) {
                    HypnoToad.Messages.list.dialog = JSON.parse(local.dialog);
                    need_redraw = true;
                }
            }
            return need_redraw;
        },

        _generate_collapse_key: function() {
            var rnd_str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
            return new Date().getTime()/1000+
                rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))+
                rnd_str.charAt(Math.floor(Math.random() * rnd_str.length));
        },

        formatTime: function(timestamp) {
            var date      = new Date(timestamp);
            var month     = chrome.i18n.getMessage('_ui_month'+(date.getMonth()+1));
            var hour      = (date.getHours() < 10) ? '0'+date.getHours() : date.getHours();
            var min       = (date.getMinutes() < 10) ? '0'+date.getMinutes() : date.getMinutes();
            var fdate     = date.getDate()+' '+month+' <span class="time">'+hour+':'+min+'</span>';
            return fdate;
        },

        MarkAsRead: function(id_arr) {
            // asking BG to do the job
            chrome.extension.sendRequest({action: 'bg_mark_as_read', data: id_arr});
        },

        New: {
            reply_number: '',       // used in send_reply form
            rcpt        : [],
            sending     : false,    // flag that indicates that sms sending is
                                    // in progress

            SendReply: function() {
                // don't do anything if another sms sending is in progress
                if (HypnoToad.Messages.New.sending) return false;

                HypnoToad.log('UI: Send Reply called');

                var textinput = $('#replysms');
                var smstext   = textinput.text().trim();

                // lets show a warning if there's no text to send
                if (smstext == '') {
                    HypnoToad.warn('UI: sms without text. Exiting');
                    return false;
                }

                // generating bogus collapse key
                var collapse_key = HypnoToad.Messages._generate_collapse_key();
                var phone_number = HypnoToad.Messages.New.reply_number;

                // disable reply button to prevent double clicks
                $('#replysmsbtn').hide();

                var sending_tmpl = '\
                    <div class="history_item me sending">\
                        <div class="history_rcpt">${name}<br /><span class="date"> </span></div>\
                        <div class="history_text">${text}</div>\
                    </div>';

                $('#contact_history').prepend(
                    jQuery.tmpl(sending_tmpl, {
                        name: chrome.i18n.getMessage('_me'),
                        text: smstext
                    })
                );

                // saving draft for the first time
                // in case if sms sending will fail and user closes popup
                HypnoToad.Messages.Draft.Save();
                // clear number of SMS and input field
                HypnoToad.Contacts.CountSMS(document.getElementById('replysms').innerHTML='');
                // set flag
                HypnoToad.Messages.New.sending = true;

                chrome.extension.sendRequest(
                    {
                        action : 'bg_send_sms',
                        data: {
                            'message'       : encodeURIComponent(smstext),
                            'collapse_key'  : collapse_key,
                            'phone_number'  : encodeURIComponent(phone_number)
                        }
                    }
                );

                textinput.focus();
                return true;
            },

            // BG send signal when sending actually completes
            // no error display for now
            SendReplyFinished: function() {
                // sending competed. Now we can safely clean draft
                HypnoToad.Messages.Draft.text = '';
                HypnoToad.Messages.Draft.Save();

                HypnoToad.Messages.New.sending = false;
                // enable Reply button
                $('#replysmsbtn').show();
                $('div.sending').removeClass('sending');

                return true;
            }
        }
    },

    Contacts: {
        list            : [],    // list of contacts
        selected        : false, // id of the selected contact
        phones_lookup   : false, // lookup to speedup contacts list search

        info_data: {
            phones: []
        },

        /*
            Count number of symbols in SMS and draw number of sms
            that will be sent
        */
        CountSMS: function(input) {
            var text = $(input).text().trim();
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
        },

        /*
            Takes contact id and shows a dialog
        */
        Info: function(cid) {
            // send signal to BG to load data
            chrome.extension.sendRequest({action: 'bg_load_dialog', cid:cid });

            var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)];
            var phones  = [];

            if (contact && contact['phones'] && contact['phones'].length > 0) {
                for (var i = contact.phones.length-1; i >= 0; i--) {
                    phones.push(contact.phones[i].number);
                }
            }
            if (phones.length < 1) {
                HypnoToad.error('Contact cid='+cid+' doesn\'t have any phones numbers');
            }
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

            //HypnoToad.UI.Status(chrome.i18n.getMessage('_ui_loading'));
            HypnoToad.log('UI: reply number '+HypnoToad.Messages.New.reply_number);

            $('#user').html('').append(
                jQuery.tmpl(user_tmpl , {
                    user_name   : contact.name,
                    user_phone  : chrome.i18n.getMessage('loading'),
                    send_reply_label: chrome.i18n.getMessage('_send_reply')
                })
            ).show();

            // send a signal to background to indicate that we have active dialog
            chrome.extension.sendRequest({action: 'bg_dialog_active', data: phones.join(' ')});


            $('#replysms').bind('keyup', function(e){
                HypnoToad.Contacts.CountSMS(this);
            });

            // bind Ctrl+Enter to send sms
            $('#replysms').keydown(
                function (e) {
                    // don't do anything if another sms sending is in progress
                    if (HypnoToad.Messages.New.sending) {
                        return false;
                    }
                    if (e.ctrlKey && e.keyCode == 13) {
                        HypnoToad.Messages.New.SendReply();
                    }
                    return true;
                }
            );

        },

        FindByPhone: function(phone) {
            var lookup = HypnoToad.Contacts.phones_lookup;
            var list = HypnoToad.Contacts.list;

            // while contacts are not loaded - do nothing
            if (!list||list.length ==0) return false;

            // if lookup is empty we need to init it first
            if (!lookup) {
                lookup   = {};
                for (var i = 0; i < list.length; i++) {
                    for (var j = 0; j < list[i].phones.length; j++) {
                        var number = list[i].phones[j].number;
                        lookup[number] = i;
                    }
                }
                HypnoToad.Contacts.phones_lookup = lookup;
            }
            if (!phone) return -1;
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

            if (!name_part) {
                name_part = $('#contacts_sort').val().trim();
            }
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

            for (i in new_sms_rcpt) {
                if (!new_sms_rcpt.hasOwnProperty(i)) continue;

                var id      = HypnoToad.Contacts.FindById(i);
                var el      = jQuery.extend(true, {}, list[id]);

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

            for (i = 0; i < list.length; i++) {
                if (new_sms_rcpt[list[i].id]) continue;

                if (name_part != '') {
                    var index_start = list[i].name.toLowerCase().indexOf(name_part);
                    if (index_start != -1) {
                        var el  = jQuery.extend(true, {}, list[i]);
                        el.name = el.name.substring(0, index_start)+'<u>'+el.name.substr(index_start, name_part.length)+'</u>'+el.name.substring(index_start+name_part.length, el.name.length);
                        res.push(el);
                    }
                } else {
                    res.push(list[i]);
                }
            }

            if (res.length > 0) {
                HypnoToad.UI.DrawContacts(res);
            } else {
                $('#contacts_list').html('<div id="nothing_found">'+chrome.i18n.getMessage('_ui_no_contacts_math_filtering')+'</div>');
            }

            return 1;
        },

        // type could be 'name' or 'secondname'
        Sort: function(type) {
            if (type === 'name' && HypnoToad.Contacts.list) {
                return HypnoToad.Contacts.list.sort(function(a,b){
                    if (a.name < b.name) return -1;
                    if (a.name > b.name) return 1;
                    return 0;
                });
            }
            return true;
        },

        // loads contact list and return true if it was actually updated
        Load: function() {
            //HypnoToad.log('UI: ... getting Contacts from local storage');
            var contacts = window.localStorage.getItem('Hypno_contacts');
            if (JSON.stringify(HypnoToad.Contacts.list) != contacts) {
                HypnoToad.Contacts.list = JSON.parse(contacts);
                HypnoToad.Contacts.list = HypnoToad.Contacts.Sort('name');
                // resetting lookup cache
                HypnoToad.Contacts.phones_lookup = false;
                return true;
            }
            return false;
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
            HypnoToad.Urls.send_status = HypnoToad.Urls.appEngine+"message?action=get_status&ver="+HypnoToad.version+'&collapse_key=';

            HypnoToad.Urls.messages = {
                'get': {
                    unread  : HypnoToad.Urls.appEngine+"sms?action=get&ver="+HypnoToad.version,
                    outgoing: HypnoToad.Urls.appEngine+'message?action=get&ver='+HypnoToad.version
                }
            };
            HypnoToad.Urls.set_status  = HypnoToad.Urls.appEngine+"sms?action=update_status&ver="+HypnoToad.version+"&status=30&collapse_key=";
        }
    }
};
