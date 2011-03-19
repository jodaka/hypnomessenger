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
                console.log('~~~~~> got signal'+request['action']);
                if (request['action'] == 'reload_lists') {
                    HypnoToad.Messages.Load();
                }
                if (request['action'] == 'reload_contacts') {
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
                console.error('Need authorization');
                //HypnoToad.UI.DrawNotRegistered();
                window.location.href = HypnoToad.Urls.signIn;
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
        body: document.getElementById('body'),

        Close: function() {
            //_gaq.push(['_trackEvent', 'Menu CLOSE', 'clicked']);
            window.close();
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
        
        MenuClick: function(id) {
            var $id = $('#'+id);
            var $div = $('#'+id.replace(/h2_/, ''));


            if ($div.is(":visible")) return 1;
            
            if (id == 'h2_compose' && $('#contact').is(":visible")) {
                HypnoToad.Contacts.CloseInfo();
                HypnoToad.Messages.Incoming.Draw();
            }

            $('#main div.section:visible').fadeOut('fast', 0, function(){
                $div.show();
                $('#menu div.active_h2').removeClass('active_h2');
                $id.addClass('active_h2');
            });
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

            // bind menu
            $('#menu div').bind('click', function(){
                HypnoToad.UI.MenuClick(this.id);
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
                HypnoToad.Messages.Incoming.Draw();
                if (HypnoToad.Messages.list.incoming.length > 0) {
                    console.log('got new messages... redrawing contact list');
                    HypnoToad.Contacts.Filter();
                }
            }
        },

        New: {
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
                    alert('wrong symbols in number');
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
                                        <div class="rcpt_phone">${phone}</div>\
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
                        name    : name,
                        phone   : recipients[r].phone
                    });

                    // binding removing client
                    $('div.rcpt_del', rcpt).bind('click', {cid: recipients[r].id}, function(event){
                        HypnoToad.Messages.New.RemoveRcpt(event.data.cid);
                        HypnoToad.Contacts.Filter();
                    });

                    // binding number changing
                    $('div.rcpt_phone', rcpt).bind('click', {id: r, phone: recipients[r].phone, cid: recipients[r].id}, function(event){
                        HypnoToad.Messages.New.ChangePhone(this, event.data.id, event.data.cid, event.data.phone);
                    });

                    rcpt_holder.append(rcpt);
                    if (recipients[r].change == 1) {
                        HypnoToad.Messages.New.ChangePhone(rcpt, r, recipients[r].id, recipients[r].number);
                    }
                }
            },

            ChangePhone: function(rcpt_div, id, cid, phone) {
                var $rcpt_div = $(rcpt_div);
                var pos       = $rcpt_div.position();

                var pselect = HypnoToad.Messages.New.rcpt[id].change;
                // changing number for contact with primary number
                $('div.number_change').remove();

                var select = $('<div class="number_change"></div>');
                var phones = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)].phones;
                for (var i = 0, max = phones.length; i < max; i++) {
                    select.append(
                        $('<div class="phone"></div>')
                            .append(
                                phones[i].number
                            )
                            .bind('click', {id: id, phone: phones[i].number}, function(event){
                                HypnoToad.Messages.New.rcpt[event.data.id].phone  = event.data.phone;
                                HypnoToad.Messages.New.rcpt[event.data.id].change = 0;
                                $('div.number_change').remove();
                                HypnoToad.Messages.New.RedrawRcpt();
                            })
                    );
                }
                $(body).append(select);
                select.css({
                    top     : pos.top+$rcpt_div.height()+'px',
                    left    : pos.left+'px'
                });
                return 1;
            },

            AddRcpt: function(cid) {
                rcpts = HypnoToad.Messages.New.rcpt;
                for (var i = 0; i < rcpts.length; i++) {
                    if (rcpts[i].id == cid) {
                        console.log('already added');
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
                            phone   : 'click to sel',
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

            Send: function() {
                var phones = [];

                var rcpts = HypnoToad.Messages.New.rcpt;

                for (var i = 0; i < rcpts.length; i++) {
                    phones.push(HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(rcpts[i].id)].phones[0].number);
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
                    if (phone_number == '+') continue;

                    var collapse_key = new Date().getTime()/1000+
                        rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))+
                        rnd_str.charAt(Math.floor(Math.random() * rnd_str.length))

                    var send_url = HypnoToad.Urls.send+
                        '&collapse_key='+collapse_key+
                        '&phone_number='+encodeURIComponent(phone_number)+
                        '&message='+encodeURIComponent(text)

                    //HypnoToad.Messages.Outgoing.Save(phone_number, text, collapse_key);
                    //alert('message sent turned off');
                    //return 1;

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
                HypnoToad.Messages.Incoming.Draw();
                HypnoToad.Notifications.UpdateIcon();
                HypnoToad.Contacts.Filter();
            },

            Draw: function() {
                // setting header
                var total_label = (HypnoToad.Messages.list.incoming.length > 0)
                    ? ' ('+chrome.i18n.getMessage('new')+' '+HypnoToad.Messages.list.incoming.length+')'
                    : '';
                document.getElementById('h2_history').innerHTML = chrome.i18n.getMessage('history')+total_label;

                var items  = HypnoToad.Messages.list.incoming;

                var self = $('#history_messages');
                self.html('');
                $('#history').html('').append('<h2>'+chrome.i18n.getMessage('_ui_new_messages')+'</h2>').append(self);

                var list = HypnoToad.Messages.list.incoming;

                for (var i = 0, max = list.length; i < max; i++) {
                    var style = (list[i].hasOwnProperty('id')) ? 'notme' : 'me';
                    var fdate = HypnoToad.Messages.Incoming.formatTime(list[i].create_time);

                    var contact_id  = HypnoToad.Contacts.FindByPhone(list[i].phone_number);
                    var rcpt_name   = (contact_id) ? HypnoToad.Contacts.list[contact_id].name : list[i].phone_number;
                    var real_id     = (HypnoToad.Contacts.list[contact_id]) ? HypnoToad.Contacts.list[contact_id].id : false;

                    self.append(
                        $('<div class="history_item '+style+'"></div>')
                        .append('<div class="history_rcpt">'+rcpt_name+' <br /><span class="date">'+fdate+'</span></div>')
                        .append(
                            $('<div class="history_text">'+list[i].message+'</div>')
                        )
                        .bind('click', {id: i}, function(e){
                            HypnoToad.Messages.Incoming.MarkAsRead(e.data.id);
                        })
                    );
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
            from: [],
        },
        /*
            Takes contact id and shows a detailed contact info
        */
        Info: function(cid) {
            $('#contacts').hide();
            HypnoToad.UI.MenuClick('h2_history');
            var contact = HypnoToad.Contacts.list[HypnoToad.Contacts.FindById(cid)];

            var self = $('#history_messages').html('');

            var phones_numbers = '';
            var phones = contact.phones;
            var phones_html = $('<ul class="phones_list"></ul>');
            for (var i = 0; i < phones.length; i++) {
                phones_html.append('<li>'+phones[i].number+'</li>');
                phones_numbers += phones[i].number+',';
                if (!/^\+/.test(phones[i].number)) {
                    phones_numbers += '+'+phones[i].number+',';
                }
            }
            var contact_info = $('#contact').html('');
            contact_info.append('<div class="contact_info"><div class="avatar_sms"> </div><div class="contact_name">'+contact.name+'</div></div>');
            contact_info
                .append('<div class="phones_list">'+chrome.i18n.getMessage('_phones_list')+'</div>')
                .append(phones_html)
                .show();

            $('#history').html('').append('<h2>'+chrome.i18n.getMessage('messages_history')+'</h2>').append(self);

            self.append('<div id="contact_history"></div>');

            jQuery.when(
                jQuery.ajax({
                    url: HypnoToad.Urls.messages.get.unread+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                    dataType: 'json'
                   
                }),
                jQuery.ajax({
                    url: HypnoToad.Urls.messages.get.outgoing+'&phone_numbers='+encodeURIComponent(phones_numbers),
                    dataType: 'json'
                  
                })
            ).done(function(ajax1, ajax2){
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

                // Drawing
                var list = from;
                var self = $('#contact_history');
                self.html('');
                
                for (var i = 0, max = list.length; i < max; i++) {
                    var style = (list[i].hasOwnProperty('id')) ? 'notme' : 'me';
                    var fdate = HypnoToad.Messages.Incoming.formatTime(list[i].create_time);
                    var rcpt_name = (list[i].hasOwnProperty('id')) ? contact.name : chrome.i18n.getMessage('_me');

                    self.append(
                        $('<div class="history_item '+style+'"></div>')
                        .append('<div class="history_rcpt">'+rcpt_name+' <br /><span class="date">'+fdate+'</span></div>')
                        .append(
                            $('<div class="history_text">'+list[i].message+'</div>')
                        )
                        .bind('click', {id: i}, function(e){
                            console.log('NO ACTION HERE sorry');
                            //HypnoToad.Messages.Incoming.MarkAsRead(e.data.id);
                        })
                    );
                }
            });
        },
        
        CloseInfo: function() {
            console.log('CloseInfo callled');
            $('#contact').hide();
            $('#contacts').show();
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

            //var rcpt_in_new_msg = {};
            //for (var i = 0; i < HypnoToad.Messages.New.rcpt.length; i++) {
            //    rcpt_in_new_msg[HypnoToad.Messages.New.rcpt[i].id] = 1;
            //}

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
                            HypnoToad.Contacts.Info(event.data.cid);
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
                                        HypnoToad.Contacts.Info(event.data.cid);
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
            HypnoToad.Urls.signIn      = HypnoToad.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(HypnoToad.Urls.index)+"&ver="+HypnoToad.version;
            HypnoToad.Urls.signOut     = HypnoToad.Urls.appEngine+"sign?action=signout&extret=OK&ver="+HypnoToad.version;
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