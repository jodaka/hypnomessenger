var HypnoToad = {

    version : -1,

    Init: function(ver) {
        HypnoToad.version = ver;
        // draw loading
        HypnoToad.UI.DrawLoading();

        // initializing urls
        HypnoToad.Urls.Init();

        // init translations
        HypnoToad.UI.DrawTranslations();

        // add listener to communicate with popup page
        chrome.extension.onRequest.addListener(
            function(request, sender, sendResponse) {
                console.log('~~~~~> GUI got signal'+request['action']);
                if (request['action'] == 'reload_lists') {
                    HypnoToad.Messages.Load();
                }
                if (request['action'] == 'reload_contacts') {
                    HypnoToad.Contacts.Load();
                }
                
                if (request['action'] == 'reload_messages') {
                    HypnoToad.Contacts.Load();
                }
            }
        );

        var status = window.localStorage.getItem('Hypno_status');
        switch (status) {
            case 'device_not_registered':
                console.error('DEV NOT REGISTERED CATCHED');
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
                console.log('all is fine');
            break;
        }

        // get contacts list
        HypnoToad.Contacts.Init();

        HypnoToad.Messages.Init();
    },

    UI: {
        section: 'new',
        body: document.getElementById('body'),

        Close: function() {
            //_gaq.push(['_trackEvent', 'Menu CLOSE', 'clicked']);
            window.close();
        },

        Status: function(text){

            if (!text || text == '') {
                $('#status').remove();
                return 1;
            }
    
            if ($('#status').length > 0) {
                $('#status').html(text);
            } else {
                $(body).append($('<div id="status">'+text+'</div>'));
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
            var main_pos    = $('#main').position();
            var loading_div = $('#loading').css({
                'top' : main_pos.top+'px',
                'left': main_pos.left+'px'
            });
            loading_div.html(chrome.i18n.getMessage('_ui_loading'));
            return 1;
        },

        DrawNotRegistered: function() {
            var loading = $('#loading');
            loading.show().html('<h2>'+chrome.i18n.getMessage('_ui_device_not_registered_header')+'</h2>\
                                <div class="dnr">'+chrome.i18n.getMessage('_ui_device_not_registered_text')+'</div>');
        },

        DrawTranslations: function() {
            document.getElementById('nm_send_btn').value = chrome.i18n.getMessage('_ui_send_btn');
            document.getElementById('contacts_header_title').innerHTML = chrome.i18n.getMessage('_ui_contacts_header');

            document.getElementById('nw_rcpt_label').innerHTML = chrome.i18n.getMessage('_ui_nw_rcpt_label');
            document.getElementById('nw_text_label').innerHTML = chrome.i18n.getMessage('_ui_nw_text_label');

            document.getElementById('h2_history').innerHTML = chrome.i18n.getMessage('incoming');
            document.getElementById('h2_compose').innerHTML = chrome.i18n.getMessage('compose');

            document.getElementById('header').innerHTML      = chrome.i18n.getMessage('_ui_header');
            document.getElementById('h2_contact').innerHTML  = chrome.i18n.getMessage('contact_details');

        },
        
        Show: function(section, data) {
            console.log('  == Show('+section+','+data+') ');
            if (section == HypnoToad.UI.section) return 1;
            
            if (section != 'user' && $('#contact').is(":visible")) {
                //HypnoToad.Contacts.CloseInfo();
                $('#contact').hide();
                $('#contacts').show();
            }

            HypnoToad.UI.section = section;

            switch (section) {
                case 'compose':
                    $('#main div.section:visible').fadeOut('fast', 0, function(){
                        $('#compose').show();
                        $('#menu div.active_h2').removeClass('active_h2');
                        $('#h2_compose').addClass('active_h2');
                    });
                break;

                case 'history':
                    $('#main div.section:visible').fadeOut('fast', 0, function(){
                        $('#history').show();
                        $('#menu div.active_h2').removeClass('active_h2');
                        $('#h2_history').addClass('active_h2');
                        HypnoToad.Messages.Incoming.Draw('history');
                    });
                break;

                case 'new':
                    $('#main div.section:visible').fadeOut('fast', 0, function(){
                        $('#compose').show();
                        $('#menu div.active_h2').removeClass('active_h2');
                        $('#h2_compose').addClass('active_h2');
                        HypnoToad.Messages.Incoming.Draw('new');
                    });
                break;

                case 'user':
                    $('#contacts').hide();
                    $('#main div.section:visible').fadeOut('fast', 0, function(){
                        $('#user').show();
                        $('#menu div.active_h2').removeClass('active_h2');
                        HypnoToad.Contacts.Info(data);
                    });
                break;
            }
        },

        Load: function() {
            // remove loading screen
            $('#loading').hide();

            console.log('... UI.Load() started');
            HypnoToad.Contacts.Filter();
            //HypnoToad.Contacts.DrawUI(HypnoToad.Contacts.list);

            $('#contacts_sort').bind('keyup', function(){
                HypnoToad.Contacts.Filter(this.value);
            });

            $('#nm_send_btn').bind('click', function(){
                HypnoToad.Messages.New.Send();
            });

            $('#nm_text_value').bind('change', function(){
                HypnoToad.Messages.New.RedrawNotes();
            });
            $('#nm_text_value').bind('keyup', function(){
                HypnoToad.Messages.New.RedrawNotes();
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

            HypnoToad.Messages.New.RedrawNotes();
            console.log('... UI.Load() finished');
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
        list : {
            incoming: [],
            outgoing: [],
            viewed  : [],
            history : []
        },

        Init: function() {
            HypnoToad.Messages.Load();
            //HypnoToad.Messages.Outgoing.Init();
            HypnoToad.Messages.New.Init();
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
                    console.log('got new messages... redrawing contact list');
                    HypnoToad.Contacts.Filter();
                }
            }
        },

        New: {
            reply_number: '',  // used in send_reply form 
            rcpt: [],
            Init: function(){
                $('#nm_to_value').bind('focus', function(){
                    $(this).val('');
                });
                $('#nm_to_value').bind('blur', function(){
                    HypnoToad.Messages.New.AddCustomNumber();
                    $(this).val('+');
                });
            },

            AddCustomNumber: function() {
                // on number entering we should add it to list and clear input field
                var self = $('#nm_to_value');
                var value = self.val().trim();

                if (!/[\d+]+/.test(value)) {
                    HypnoToad.UI.Status('wrong symbols in number');
                    return 0;
                }

                HypnoToad.Messages.New.rcpt.push({
                    id      : new Date().getTime(),
                    phone   : value,
                    change  : 0
                });

                self.val('');
                HypnoToad.Messages.New.RedrawRcpt();
            },

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
                var note2 = 'Messages to sent: '+sms_count*HypnoToad.Messages.New.rcpt.length;
                $('#nm_notes').html(note1+note2);
            },

            RedrawRcpt: function() {
                var rcpt_holder = $('#contact_recipients');
                rcpt_holder.html('');

                var recipients  = HypnoToad.Messages.New.rcpt;
                //console.log(recipients);

                var rcpt_tmpl = '<div class="rcpt">\
                                    <div class="rcpt_data">\
                                        <div class="rcpt_name">${name}</div>\
                                    </div>\
                                    <div class="rcpt_del"><img src="img/blank.png" alt=""/></div>\
                                </div>';

                for (var r = 0; r < recipients.length; r++) {

                    var rcpt_id      = recipients[r].id;
                    var contact_id   = HypnoToad.Contacts.FindById(rcpt_id);
                    var name = (contact_id == -1)
                        ? chrome.i18n.getMessage('_ui_contact_anon')
                        : HypnoToad.Contacts.list[contact_id].name

                    // filling template with data
                    var rcpt = jQuery.tmpl(rcpt_tmpl, {
                        name    : name
                    });
                    // binding removing client
                    $('div.rcpt_del', rcpt).bind('click', {cid: recipients[r].id}, function(event){
                        HypnoToad.Messages.New.RemoveRcpt(event.data.cid);
                        HypnoToad.Contacts.Filter();
                    });

                    rcpt_holder.append(rcpt);
                    if (recipients[r].change == 1) {
                        HypnoToad.Messages.New.ChangePhone(rcpt, r, recipients[r].id, recipients[r].number);
                    }
                }
            },

            ChangePhone: function(rcpt_div, id, cid, phone) {
                var pselect = HypnoToad.Messages.New.rcpt[id].change;
                var fader  = $('<div id="fader"></div>');

                var select = $('<div id="number_change"></div>');
                select.append('<h3>'+chrome.i18n.getMessage('_select_number')+'</h3>');
                
                var phones = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)].phones;
                var ul = $('<ul></ul>');
                for (var i = 0, max = phones.length; i < max; i++) {
                    ul.append(
                        $('<li>'+phones[i].number+'</li>')
                            .bind('click', {id: id, phone: phones[i].number}, function(event){
                                HypnoToad.Messages.New.rcpt[event.data.id].phone  = event.data.phone;
                                HypnoToad.Messages.New.rcpt[event.data.id].change = 0;
                                $('#fader').remove();
                                $('#number_change').remove();
                            })
                    );
                }
                select.append(ul);
                $(body).append(fader).append(select);
                return 1;
            },

            AddRcpt: function(cid) {
                rcpts = HypnoToad.Messages.New.rcpt;
                for (var i = 0; i < rcpts.length; i++) {
                    if (rcpts[i].id == cid) {
                        HypnoToad.UI.Status(chrome.i18n.getMessage('_rcpt_already_added'));
                        console.log(chrome.i18n.getMessage('_rcpt_already_added'));
                        return 1;
                    }
                }

                console.log('Adding rcpt '+cid);
                var phones = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)].phones;

                if (phones.length > 1) {
                    var primary_number = false;
                    for (var i = 0, max = phones.length; i < max; i++) {
                        if (phones[i].primary) primary_number = phones[i].number;
                    }

                    if (!primary_number) {
                        HypnoToad.Messages.New.rcpt.push({
                            id      : cid,
                            phone   : '',
                            change  : 1
                        });
                    } else {
                        HypnoToad.Messages.New.rcpt.push({
                            id      : cid,
                            phone   : primary_number,
                            change  : 0
                        });
                    }

                } else {
                    HypnoToad.Messages.New.rcpt.push({
                        id      : cid,
                        phone   : phones[0].number,
                        change  : 0
                    });
                }

                HypnoToad.Messages.New.RedrawRcpt();
                HypnoToad.Messages.New.RedrawNotes()
            },

            RemoveRcpt: function(cid) {
                console.log('Removing rcpt '+cid);
                var rcpts = HypnoToad.Messages.New.rcpt;
                for (var i = 0, max = rcpts.length; i < max; i++) {
                    if (rcpts[i].id == cid) {
                        HypnoToad.Messages.New.rcpt.splice(i, 1);
                        break;
                    }
                }
                //var index = HypnoToad.Messages.New.rcpt.indexOf(cid);
                //if (index != -1) HypnoToad.Messages.New.rcpt.splice(index, 1);
                HypnoToad.Messages.New.RedrawRcpt();
                HypnoToad.Messages.New.RedrawNotes()
            },

            SendReply: function() {
                console.log('Send Reply called');

                var text    = $('#replysms').val().trim();
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
                $('#reply_icon').show();

                jQuery.when(
                    jQuery.ajax({
                        url: send_url,
                        dataType: 'json'
                    })
                ).done(function(ajax){
                    $('#replysmsbtn').show();
                    $('#reply_icon').hide();

                    if (ajax['status'] == 'OK') {

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

                        $('#replysms').val('');
                    } else {
                        console.error('message NOT sent');
                        console.error(ajax);
                    }
                });
            },

            Send: function() {
                var phones = [];

                var rcpts = HypnoToad.Messages.New.rcpt;

                for (var i = 0; i < rcpts.length; i++) {
                    phones.push(HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(rcpts[i].id)].phones[0].number);
                }

                var to      = $('#nm_to_value').val().replace(/\s/g, '');
                if (to == '' && phones.length == 0) {
                    HypnoToad.UI.Status('Hey! Add some recipients');
                    return false;
                } else {
                    if (to != '') phones.push(to);
                }

                var text    = $('#nm_text_value').val().trim();
                if (text == '') {
                    HypnoToad.UI.Status('Hey Hey Hey! Write some text');
                    return false;
                }

                var rnd_str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

                for (var p = 0; p < phones.length; p++) {
                    var phone_number = phones[p];
                    if (phone_number == '+') continue;

                    var collapse_key = new Date().getTime()/1000+
                        rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))+
                        rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))

                    var send_url = HypnoToad.Urls.send+
                        '&collapse_key='+collapse_key+
                        '&phone_number='+encodeURIComponent(phone_number)+
                        '&message='+encodeURIComponent(text)

                    // disable button
                    $('#nm_send_btn').hide();
                    $('#sending_icon').show();

                    jQuery.when(
                        jQuery.ajax({
                            url: send_url,
                            dataType: 'json'
                        })
                    ).done(function(ajax){
                        $('#sending_icon').hide();
                        $('#nm_send_btn').show();

                        if (ajax['status'] == 'OK') {

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

                            $('#nm_text_value').val('');
                            // message was sent. Now we need to check periodically for
                            // it's status
                            //HypnoToad.Messages.Sent.queue.push(collapse_key);
                        } else {
                            console.error('message NOT sent');
                            console.error(ajax);
                        }
                    });
                }

                return 1;
            }
        },

        Incoming: {
            list        : [],
            viewed      : [],
            check_timer : false,

            formatTime: function(timestamp) {
                var date      = new Date(timestamp);
                var month     = chrome.i18n.getMessage('_ui_month'+(date.getMonth()+1));
                var fdate     = date.getDate()+' '+month+' <span class="time">'+date.getHours()+':'+date.getMinutes()+'</span>';
                return fdate;
            },

            MarkAsRead: function(id) {
                var real_msg_id = HypnoToad.Messages.list.incoming[id].id;
                jQuery.ajax({
                    url: HypnoToad.Urls.set_status+real_msg_id,
                    dataType: 'json',
                    complete: function(data) {
                        // actually we should check real response here... but we are lazy
                        HypnoToad.Messages.Incoming.Store();
                    }
                });
                HypnoToad.Messages.list.viewed.push(HypnoToad.Messages.list.incoming[id]);
                HypnoToad.Messages.list.incoming.splice(id, 1);
                //HypnoToad.Messages.Incoming.Draw();
                HypnoToad.Notifications.UpdateIcon();
                HypnoToad.Contacts.Filter();
            },

            Draw: function() {

                var list = HypnoToad.Messages.list.incoming;

                var hdr_tmpl = '<h2>${new_title}</h2>';
                $('#history_header').html(
                    jQuery.tmpl(hdr_tmpl, {
                        //history_title       : chrome.i18n.getMessage('history'),
                        new_title           : chrome.i18n.getMessage('_ui_new_messages'),
                        got_new_messages    : HypnoToad.Messages.list.incoming.length
                    })
                );

                var messages = [];
                if (list.length > 0) {
                    for (var i = 0, max = list.length; i < max; i++) {
                        var message = {
                            'id'    : i,
                            'class' : (list[i].hasOwnProperty('id')) ? 'notme' : 'me',
                            'date'  : HypnoToad.Messages.Incoming.formatTime(list[i].create_time),
                            'name'  : (list[i].hasOwnProperty('id')) ? contact.name : chrome.i18n.getMessage('_me'),
                            'text'  : list[i].message
                        };
                        messages.push(message);
                    }
    
                    var history_tmpl = '\
                        {{each items}}\
                            <div class="history_item ${$value.class}">\
                                <div class="history_rcpt">${$value.name}<br /><span class="date">{{html $value.date}}</span></div>\
                                <div class="history_text" onclick="HypnoToad.Messages.Incoming.MarkAsRead(\'${$value.id}\'); HypnoToad.Messages.Incoming.Draw()">${$value.text}</div>\
                            </div>\
                        {{/each}}\
                        ';
    
                    $('#history_messages').html(
                        jQuery.tmpl(history_tmpl, {
                            items           : messages
                        })
                    );
                } else {
                    $('#history_messages').html('_no_new_messages_');
                }
            },

            LoadViewed: function() {
                var viewed = window.localStorage.getItem('Hypno_messages_viewed');
                if (viewed) {
                    viewed = JSON.parse(viewed);
                    HypnoToad.Messages.list.viewed = viewed;
                    console.log('Viewed messages loaded');
                    console.log(viewed);
                }
            },

            Store: function() {
                window.localStorage.removeItem('Hypno_messages_viewed');
                window.localStorage.setItem('Hypno_messages_viewed',  JSON.stringify(HypnoToad.Messages.list.viewed));
            }
        },

        // this will hold SMS that were already sent by web interface
        Sent: {
            queue_process_timer: false,
            queue: [],
            GetStatus: function(collapse_key) {
                jQuery.ajax({
                    url: HypnoToad.Urls.send_status+collapse_key,
                    dataType: 'json',
                    complete: function(data) {
                        try {
                            json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                        } catch (err) {
                            console.warn(err);
                            return false;
                        }

                        if (json.status == "OK") {
                            // message was sent. Now we need to check periodically for
                            // it's status
                            HypnoToad.Messages.Sent.MarkAsDelivered(collapse_key);
                            return 1;
                        }

                        if (json.status == "SIGNIN_REQUIRED") {
                            window.location.href = HypnoToad.Urls.signIn;
                            return 1;
                        }
                    }
                });
            },

            ProcessQueue: function() {
                var queue = HypnoToad.Messages.Sent.queue;
                if (queue.length == 0) return 0;
                for (var i = 0; i < queue.length; i++) {
                    HypnoToad.Messages.Sent.GetStatus(queue[i]);
                }
            },

            MarkAsDelivered: function(collapse_key) {
                //var items = HypnoToad.Messages.Outgoing.list;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].collapsekey == collapse_key) {
                        items[i].status = 'delivered';
                        //HypnoToad.Messages.Outgoing.Store();
                        break;
                    }
                }
                
                // delete from queue
                var queue = HypnoToad.Messages.Sent.queue;
                queue = queue.splice(queue.indexOf(collapse_key), 1);
                HypnoToad.Messages.Sent.queue = queue;
            }
        }
    },

    Contacts: {
        list: [],
        phones_lookup: false,
        info_data: {
            to: [],
            from: []
        },
        /*
            Takes contact id and shows a detailed contact info
        */
        Info: function(cid) {
            // User info
            var contact_info_tmpl = '\
                <div class="contact_info">\
                    <div class="avatar_sms"> </div>\
                    <div class="contact_name">${contact_name}</div>\
                </div>\
                <div class="phones_list">${phones_list_label}</div>\
                <ul class="phones_list">\
                {{each phone}} \
                    <li>${$value}</li>\
                {{/each}}\
                </ul>\
                <input type="button" id="close_info" value="${close_info_label}" onclick="HypnoToad.UI.Show(\'history\')">';

            var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)];
            var phones  = [];
            for (var i = 0; i < contact.phones.length; i++) {
                //if (!contact.phones[i].number.match(/^\+/)) contact.phones[i].number = '+'+contact.phones[i].number; // HACK REMOVE ME!!! FIXME (after server fixed)
                phones.push(contact.phones[i].number);
            }

            $('#contact').html(
                jQuery.tmpl(contact_info_tmpl, {
                    contact_name     : contact.name,
                    phones_list_label: chrome.i18n.getMessage('_phones_list'),
                    phone            : phones,
                    close_info_label : chrome.i18n.getMessage('_close_info')
                })
            ).show();
            var phones_numbers = phones.join(',');
            //console.log(phones_numbers);
            $('#user_header').html(chrome.i18n.getMessage('messages_history'));
            HypnoToad.UI.Status(chrome.i18n.getMessage('_ui_loading'));

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

                HypnoToad.Messages.New.reply_number = '';
                var messages = [];
                for (var i = 0, max = from.length; i < max; i++) {
                    var message = {
                        'id'    : i,
                        'class' : (from[i].hasOwnProperty('id')) ? 'notme' : 'me',
                        'date'  : HypnoToad.Messages.Incoming.formatTime(from[i].create_time),
                        'name'  : (from[i].hasOwnProperty('id')) ? contact.name : chrome.i18n.getMessage('_me'),
                        'text'  : from[i].message
                    };
                    messages.push(message);
                    if (message['class'] == 'notme' && HypnoToad.Messages.New.reply_number == '') {
                        HypnoToad.Messages.New.reply_number = from[i].phone_number;
                    }
                }

                var history_tmpl = '\
                    <textarea id="replysms" rows="3"></textarea>\
                    <div id="nm_reply">\
                        <label id="send_label" for="replysmsbtn">\
                            <input type="button" value="${send_reply_label}" id="replysmsbtn" onclick="HypnoToad.Messages.New.SendReply()"/>\
                                <img id="reply_icon" src="img/sending.gif" alt="" style="display: none" />\
                        </label>\
                    </div>\
                    {{each items}}\
                        <div class="history_item ${$value.class}">\
                            <div class="history_rcpt">${$value.name}<br /><span class="date">{{html $value.date}}</span></div>\
                            <div class="history_text">${$value.text}</div>\
                        </div>\
                    {{/each}}\
                    ';
                console.log('reply number '+HypnoToad.Messages.New.reply_number);
                $('#contact_history').html(
                    jQuery.tmpl(history_tmpl, {
                        reply_form      : HypnoToad.Messages.New.reply_number,
                        send_reply_label: chrome.i18n.getMessage('_send_reply'),
                        items           : messages
                    })
                );
            });
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
            console.log('... getting Contacts from local storage');
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
                            .append(avatar)
                            .append(
                                $('<div class="contact_name">'+list[i].name+'</div>')
                                .bind('click', {cid: list[i].id}, function(event){
                                    if ($('#h2_compose').hasClass('active_h2')) {
                                        // we are on 'Compose' tab
                                        HypnoToad.Messages.New.AddRcpt(event.data.cid);
                                        HypnoToad.Contacts.Filter();
                                    } else {
                                        // we are on history tab
                                        HypnoToad.UI.Show('user', event.data.cid);
                                    }
                                })
                            )
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
        index       : chrome.extension.getURL('hypno_gui.html'),

        Init: function() {
            console.log('... Urls.Init() started');
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