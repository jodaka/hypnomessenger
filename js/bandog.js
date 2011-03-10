if ($.browser.mozilla) {
    var chrome = {
        i18n: {
            getMessage: function(msg) {
                if (i18 && i18[msg]) {
                    return i18[msg];
                } else {
                    return 'lang resources are not available';
                }
            }
        },
    
        extension: {
            getURL: function(path) {
                return path;
            }
        }
    };
}

var Bandog = {

    version : -1,

    Init: function(ver) {
        Bandog.version = ver;
        // draw loading
        Bandog.UI.DrawLoading();

        // initializing urls
        Bandog.Urls.Init();

        // init translations
        Bandog.UI.DrawTranslations();

        // get contacts list
        Bandog.Contacts.Get();

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

            document.getElementById('h2_outgoing').innerHTML = chrome.i18n.getMessage('outgoing');
            document.getElementById('h2_incoming').innerHTML = chrome.i18n.getMessage('incoming');
            document.getElementById('h2_compose').innerHTML = chrome.i18n.getMessage('compose');

            document.getElementById('header').innerHTML      = chrome.i18n.getMessage('_ui_header');
            document.getElementById('h2_contact').innerHTML  = chrome.i18n.getMessage('contact_details');

        },
        
        MenuClick: function(id) {
            var $id = $('#'+id);
            var $div = $('#'+id.replace(/h2_/, ''));

            if ($div.is(":visible")) return 1;
            if (id != 'h2_contact') {
                $('#h2_contact').hide();
            } else {
                $('#h2_contact').show();
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
            Bandog.Contacts.Filter();
            //Bandog.Contacts.DrawUI(Bandog.Contacts.list);

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

            // bind menu
            $('#menu div').bind('click', function(){
                Bandog.UI.MenuClick(this.id);
            });

            Bandog.Messages.New.RedrawNotes();
            console.log('... UI.Load() finished');
            return 1;
        }
    },


    Notifications: {
        UpdateIcon: function() {
            if ($.browser.webkit) {
                if ($.browser.webkit) {
                    chrome.browserAction.setBadgeText({text: String(Bandog.Messages.Received.list.length)})
                }
            }
        }
    },

    Messages: {
        Init: function() {
            Bandog.Messages.Received.Load();
            Bandog.Messages.History.Init();
            Bandog.Messages.New.Init();
        },

        // this holds last 50 messages history 
        History: {
            items: [],
            Save: function(rcpt, text, key) {
                Bandog.Messages.History.items.push({
                    'rcpt'          : rcpt,
                    'text'          : text,
                    'timestamp'     : new Date().getTime(),
                    'collapsekey'   : key,
                    'status'        : 'sent'
                });

                Bandog.Messages.History.Store();
                Bandog.Messages.History.DrawTotal();
            },

            Store: function() {
                window.localStorage.removeItem('bandog_history');
                window.localStorage.setItem('bandog_history',  JSON.stringify(Bandog.Messages.History.items));
            },

            DrawTotal: function() {
                // set proper header
                document.getElementById('h2_outgoing').innerHTML =
                    chrome.i18n.getMessage('outgoing')+' ('+Bandog.Messages.History.items.length+')';
            },

            Init: function() {
                // get history from localstorage
                var history = window.localStorage.getItem('bandog_history');
                Bandog.Messages.History.items = (history)
                    ? JSON.parse(history)
                    : [];

                Bandog.Messages.History.DrawTotal();
                Bandog.Messages.History.Draw();

                // every 10s we process sent queue
                Bandog.Messages.Sent.queue_process_timer = setInterval(function(){
                    console.log('Processing sent queue');
                    Bandog.Messages.Sent.ProcessQueue();
                }, 10000);

                // every 30s we check for new messages
                Bandog.Messages.Received.check_timer = setInterval(function(){
                    console.log('Checking for new messages...');
                    Bandog.Messages.Received.Load();
                }, 30000);
            },

            Draw: function() {
                var self = $('#history');
                self.html('').append('<label>'+chrome.i18n.getMessage('_ui_sent_messages')+'</label>');
                // showing history
                var items = Bandog.Messages.History.items;
                for (var i = items.length-1; i >= 0 ; i--) {
                    var fdate       = Bandog.Messages.Received.formatTime(items[i].timestamp);
                    var contact_id  = Bandog.Contacts.FindByPhone(items[i].rcpt);
                    var rcpt_name   = (contact_id)                       ? Bandog.Contacts.list[contact_id].name : items[i].rcpt;
                    var real_id     = (Bandog.Contacts.list[contact_id]) ? Bandog.Contacts.list[contact_id].id   : false;

                    

                    var item = $('<div class="history_item"></div>')
                        .append('<div class="history_date">'+fdate+'</div>')
                        .append(
                            $('<div class="history_rcpt">'+rcpt_name+'</div>')
                            .bind('click', {cid: real_id, cid2: contact_id}, function(event){
                                if (event.data.cid) Bandog.Contacts.Info(event.data.cid);
                            })
                        )
                        .append('<div class="history_status"><div class="status_'+items[i].status+'"></div></div>')
                        .append('<div class="history_text">'+items[i].text+'</div>');
                    self.append(item);
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
                    Bandog.Messages.New.AddCustomNumber();
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

                Bandog.Messages.New.rcpt.push({
                    id      : new Date().getTime(),
                    phone   : value,
                    change  : 0
                });

                self.val('');
                Bandog.Messages.New.RedrawRcpt();
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
                var note2 = 'Messages to sent: '+sms_count*Bandog.Messages.New.rcpt.length;
                $('#nm_notes').html(note1+note2);
            },

            RedrawRcpt: function() {
                var rcpt_holder = $('#contact_recipients');
                rcpt_holder.html('');

                var recipients  = Bandog.Messages.New.rcpt;
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
                    var contact_id   = Bandog.Contacts.FindById(rcpt_id);
                    var name = (contact_id == -1)
                        ? chrome.i18n.getMessage('_ui_contact_anon')
                        : Bandog.Contacts.list[contact_id].name

                    // filling template with data
                    var rcpt = jQuery.tmpl(rcpt_tmpl, {
                        name    : name,
                        phone   : recipients[r].phone
                    });

                    // binding removing client
                    $('div.rcpt_del', rcpt).bind('click', {cid: recipients[r].id}, function(event){
                        Bandog.Messages.New.RemoveRcpt(event.data.cid);
                        Bandog.Contacts.Filter();
                    });

                    // binding number changing
                    $('div.rcpt_phone', rcpt).bind('click', {id: r, phone: recipients[r].phone, cid: recipients[r].id}, function(event){
                        Bandog.Messages.New.ChangePhone(this, event.data.id, event.data.cid, event.data.phone);
                    });

                    rcpt_holder.append(rcpt);
                    if (recipients[r].change == 1) {
                        Bandog.Messages.New.ChangePhone(rcpt, r, recipients[r].id, recipients[r].number);
                    }
                }
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
                                Bandog.Messages.New.rcpt[event.data.id].phone  = event.data.phone;
                                Bandog.Messages.New.rcpt[event.data.id].change = 0;
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
                    } else {
                        Bandog.Messages.New.rcpt.push({
                            id      : cid,
                            phone   : primary_number,
                            change  : 0
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
                    phones.push(Bandog.Contacts.list[Bandog.Contacts.FindById(rcpts[i].id)].phones[0].number);
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

                    var send_url = Bandog.Urls.send+
                        '&collapse_key='+collapse_key+
                        '&phone_number='+encodeURIComponent(phone_number)+
                        '&message='+encodeURIComponent(text)

                    Bandog.Messages.History.Save(phone_number, text, collapse_key);
                    //alert('message sent turned off');
                    //return 1;
                    
                    // disable button
                    $('#nm_send_btn').attr('disabled', 'disabled');

                    jQuery.ajax({
                        url: send_url,
                        dataType: 'json',
                        complete: function(data) {
                            try {
                                json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                            } catch (err) {
                                console.warn(err);
                                return false;
                            }
                            $('#nm_send_btn').removeAttr('disabled');
    
                            if (json.status == "OK") {
                                alert('Message SENT');
                                // message was sent. Now we need to check periodically for
                                // it's status
                                Bandog.Messages.Sent.queue.push(collapse_key);
                                return 1;
                            }
    
                            if (json.status == "SIGNIN_REQUIRED") {
                                alert('ERROR');
                                window.location.href = Bandog.Urls.signIn;
                                return 1;
                            }
                        }
                    });
                }

                return 1;
            }
        },

        Received: {
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
                var real_msg_id = Bandog.Messages.Received.list[id].id;
                jQuery.ajax({
                    url: Bandog.Urls.set_status+real_msg_id,
                    dataType: 'json',
                    complete: function(data) {
                        // actually we should check real response here... but we are lazy
                        Bandog.Messages.Received.Store();
                    }
                });
                Bandog.Messages.Received.viewed.push(Bandog.Messages.Received.list[id]);
                Bandog.Messages.Received.list.splice(id, 1);
                Bandog.Messages.Received.Draw();
                Bandog.Notifications.UpdateIcon();
                Bandog.Contacts.Filter();
            },

            Draw: function() {
                // setting header
                document.getElementById('h2_incoming').innerHTML = chrome.i18n.getMessage('incoming')+' ('+Bandog.Messages.Received.list.length+'/'+Bandog.Messages.Received.viewed.length+')';
                
                var items  = Bandog.Messages.Received.list;
                var viewed = Bandog.Messages.Received.viewed;
                var self = $('#incoming_messages');
                self.html('').
                    append('<label>'+chrome.i18n.getMessage('_ui_new_messages')+'</label>');

                for (var i = 0; i < items.length ; i++) {
                    var fdate       = Bandog.Messages.Received.formatTime(items[i].create_time);
                    var contact_id  = Bandog.Contacts.FindByPhone(items[i].phone_number);
                    var rcpt_name   = (contact_id) ? Bandog.Contacts.list[contact_id].name : items[i].phone_number;
                    var real_id     = (Bandog.Contacts.list[contact_id]) ? Bandog.Contacts.list[contact_id].id : false;
                    var item = $('<div class="history_item"></div>')
                        .append('<div class="history_date">'+fdate+'</div>')
                        .append(
                            $('<div class="history_rcpt">'+rcpt_name+'</div>')
                                .bind('click', {cid: real_id}, function(event){
                                    if (event.data.cid) Bandog.Contacts.Info(event.data.cid);
                                })
                        )
                        .append('<div class="history_text">'+items[i].message+'</div>')
                        .append(
                            $('<div class="history_ctrl"></div>')
                                .append('<input type="button" value="'+chrome.i18n.getMessage('_ui_mark_as_read')+'">')
                                .bind('click', {id: i}, function(e){
                                    Bandog.Messages.Received.MarkAsRead(e.data.id);
                                })
                        );
                    self.append(item);
                }
                
                if (viewed.length > 0) {
                    self.append('<label>'+chrome.i18n.getMessage('_ui_read_messages')+'</label>');
                    
                    for (var i = 0; i < viewed.length; i++) {
                        var fdate       = Bandog.Messages.Received.formatTime(viewed[i].create_time);
                        var contact_id  = Bandog.Contacts.FindByPhone(viewed[i].phone_number);
                        var rcpt_name   = (contact_id) ? Bandog.Contacts.list[contact_id].name : viewed[i].phone_number;
                        var real_id     = (Bandog.Contacts.list[contact_id]) ? Bandog.Contacts.list[contact_id].id : false;
                        var item = $('<div class="history_item"></div>')
                            .append('<div class="history_date">'+fdate+'</div>')
                            .append(
                                $('<div class="history_rcpt">'+rcpt_name+'</div>')
                                    .bind('click', {cid: real_id}, function(event){
                                        if (event.data.cid) Bandog.Contacts.Info(event.data.cid);
                                    })
                            )
                            .append('<div class="history_text">'+viewed[i].message+'</div>')
                            .append(
                                $('<div class="history_ctrl"></div>')
                                    .append('<input type="button" value="'+chrome.i18n.getMessage('_ui_mark_as_deleted')+'">')
                                    .bind('click', {id: i}, function(e){
                                        console.warn('DELETE SMS not implemented !!!!');
                                    })
                            );  
                        self.append(item);
                    }
                }
            },

            LoadViewed: function() {
                var viewed = window.localStorage.getItem('bandog_received_viewed');
                if (viewed) {
                    viewed = JSON.parse(viewed);
                    Bandog.Messages.Received.viewed = viewed;
                    console.log('Viewed messages loaded');
                    console.log(viewed);
                }
            },

            Store: function() {
                window.localStorage.removeItem('bandog_received_viewed');
                window.localStorage.setItem('bandog_received_viewed',  JSON.stringify(Bandog.Messages.Received.viewed));
            },

            Load: function() {
                jQuery.ajax({
                    url: Bandog.Urls.messages_get+'&status=0',
                    dataType: 'json',
                    complete: function(data) {
                        var json = {};

                        try {
                            json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                        } catch (err) {
                            console.warn(err);
                            return false;
                        }
                            Bandog.Messages.Received.list = json.sms_list.slice(0);
                            Bandog.Notifications.UpdateIcon();
                            Bandog.Messages.Received.Draw();
                            if (Bandog.Messages.Received.list.length > 0) {
                                console.log('got new messages... redrawing contact list');
                                Bandog.Contacts.Filter();
                            }
                        return 1;
                    }
                });
                jQuery.ajax({
                    url: Bandog.Urls.messages_get_viewed,
                    dataType: 'json',
                    complete: function(data) {
                        var json = {};

                        try {
                            json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                        } catch (err) {
                            console.warn(err);
                            return false;
                        }
                        Bandog.Messages.Received.viewed = json.sms_list.slice(0);
                        Bandog.Messages.Received.Draw();
                        return 1;
                    }
                });
            }
        },

        // this will hold SMS that were already sent by web interface
        Sent: {
            queue_process_timer: false,
            queue: [],
            GetStatus: function(collapse_key) {
                jQuery.ajax({
                    url: Bandog.Urls.send_status+collapse_key,
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
                            Bandog.Messages.Sent.MarkAsDelivered(collapse_key);
                            return 1;
                        }

                        if (json.status == "SIGNIN_REQUIRED") {
                            window.location.href = Bandog.Urls.signIn;
                            return 1;
                        }
                    }
                });
            },

            ProcessQueue: function() {
                var queue = Bandog.Messages.Sent.queue;
                if (queue.length == 0) return 0;
                for (var i = 0; i < queue.length; i++) {
                    Bandog.Messages.Sent.GetStatus(queue[i]);
                }
            },

            MarkAsDelivered: function(collapse_key) {
                var items = Bandog.Messages.History.items;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].collapsekey == collapse_key) {
                        items[i].status = 'delivered';
                        Bandog.Messages.History.Store();
                        break;
                    }
                }
                
                // delete from queue
                var queue = Bandog.Messages.Sent.queue;
                queue = queue.splice(queue.indexOf(collapse_key), 1);
                Bandog.Messages.Sent.queue = queue;
            }
        }
    },

    Contacts: {
        list: [],
        phones_lookup: false,

        /*
            Takes contact id and shows a detailed contact info
        */
        Info: function(cid) {
            console.log(cid);
            Bandog.UI.MenuClick('h2_contact');
            var contact = Bandog.Contacts.list[Bandog.Contacts.FindById(cid)];
            var self = $('#contact_holder').html('');

            self.append(
                '<h3>'+contact.name+'</h3>'
            );

            var phones_numbers = '';
            var phones = contact.phones;
            var phones_html = $('<ul></ul>');
            for (var i = 0; i < phones.length; i++) {
                phones_html.append('<li>'+phones[i].number+'</li>');
                phones_numbers += phones[i].number+',';
                if (!/^\+/.test(phones[i].number)) {
                    phones_numbers += '+'+phones[i].number+',';
                }
            }
            self.append(phones_html);

            self.append(
                '<label>'+chrome.i18n.getMessage('messages_history')+'</label><div id="contact_history"></div>'
            );

            jQuery.ajax({
                url: Bandog.Urls.messages_get+'&status=30&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                dataType: 'json',
                complete: function(data) {
                    try {
                        json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                    } catch (err) {
                        console.warn(err);
                        return false;
                    }
                    $('#nm_send_btn').removeAttr('disabled');

                    if (json.status == "OK") {
                        var viewed = json.sms_list;
                        var self   = $('#contact_history');
                        self.html('');
                        for (var i = 0; i < viewed.length; i++) {
                            var fdate = Bandog.Messages.Received.formatTime(viewed[i].create_time);

                            self.append(
                                '<div class="history_item">\
                                    <div class="history_date">'+fdate+'</div>\
                                    <div class="history_text">'+viewed[i].message+'</div>\
                                </div>'
                            );
                        }
                    }
                }
            });
        },

        FindByPhone: function(phone) {
            var lookup = Bandog.Contacts.phones_lookup;
            // if lookup is empty we need to init it first
            if (!lookup) {
                lookup   = {};
                var list = Bandog.Contacts.list;
                for (var i = 0; i < list.length; i++) {
                    for (var j = 0; j < list[i].phones.length; j++) {
                        var number = list[i].phones[j].number;
                            number = number.replace(/^\+/, '');
                            number = number.replace(/\s/g, '');
                        lookup[number] = i;
                    }
                }
                Bandog.Contacts.phones_lookup = lookup;
            }
            phone = phone.replace(/^\+/, '');
            phone = phone.replace(/\s/g, '');
            return lookup[phone];
        },
        FindById: function(id) {
            var list = Bandog.Contacts.list;
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

            var list = Bandog.Contacts.list;
            var res  = [];

            var rcpt_in_new_msg = {};
            for (var i = 0; i < Bandog.Messages.New.rcpt.length; i++) {
                rcpt_in_new_msg[Bandog.Messages.New.rcpt[i].id] = 1;
            }

            var new_sms_rcpt = {};
            for (var i = 0; i < Bandog.Messages.Received.list.length; i++) {
                var phone   = Bandog.Messages.Received.list[i].phone_number;
                var rcpt_id = Bandog.Contacts.FindByPhone(phone);
                if (list[rcpt_id] && !rcpt_in_new_msg[rcpt_id]) {
                    if (new_sms_rcpt[rcpt_id]) {
                        new_sms_rcpt[rcpt_id]++;
                    } else {
                        new_sms_rcpt[rcpt_id] = 1;
                    }
                }
            }

            for (var i in new_sms_rcpt) {
                var el      = new cloneObject(list[i]);
                el.new_sms  = new_sms_rcpt[i];
                if (name_part != '') {
                    var index_start = list[i].name.toLowerCase().indexOf(name_part);
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
                if (rcpt_in_new_msg[list[i].id] == 1 || new_sms_rcpt[list[i].id] == 1) {
                    continue;
                }
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

            var cache       = window.localStorage.getItem('bandog_contacts_cache');

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
                        // get messages from server
                        Bandog.Messages.Init();

                        return 1;
                    }

                    if (json.status == "SIGNIN_REQUIRED") {
                        window.location.href = Bandog.Urls.signIn;
                        return 1;
                    }
                    
                    if (json.status == "DEVICE_NOT_REGISTERED") {
                        Bandog.UI.DrawNotRegistered();
                        return 1;
                    }
                },

                error: function(data, e) {
                    console.warn('=============================');
                    console.warn(e);
                    console.warn(data);
                    console.warn('=============================');
                    
                }
            });
        },

        DrawUI: function(list) {
            //contacts
            var holder = $('<ul></ul>');

            for (var i = 0; i < list.length; i++) {
                var avatar = '<div class="contact_avatar"><img src="img/av/'+Math.ceil(Math.random()*9)+'.png" alt=""></div>';
                // draw number of new messages on avatar
                if (list[i].new_sms) {
                    avatar = $('<div class="contact_avatar"></div>')
                        .append('<img src="img/av/'+Math.ceil(Math.random()*9)+'.png" alt="">')
                        .append(
                            $('<span class="avatar_sms">'+list[i].new_sms+'</span>')
                            .bind('click', function(){
                                // go to unread messages
                                Bandog.UI.MenuClick('h2_incoming');
                            })
                        );
                }
                
                var li = $('<li></li>')
                    .append(avatar)
                    .append(
                        $('<div class="contact_info"></div>')
                            .append('<div class="contact_name">'+list[i].name+'</div>')
                            .append(
                                $('<div class="contact_add">&nbsp;</div>')
                                    .bind('click', {cid: list[i].id}, function(event){
                                        var self = $(this);
                                        Bandog.Messages.New.AddRcpt(event.data.cid);
                                        Bandog.Contacts.Filter();
                                    })
                            )
                            .append(
                                $('<div class="contact_about">&nbsp;</div>')
                                .bind('click', {cid: list[i].id}, function(event){
                                    Bandog.Contacts.Info(event.data.cid);
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
        index       : chrome.extension.getURL('index.html'),

        Init: function() {
            console.log('... Urls.Init() started');
            Bandog.Urls.appEngine   = "http://"+Bandog.version+".latest.bandog812.appspot.com/";
            Bandog.Urls.signIn      = Bandog.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(Bandog.Urls.index)+"&ver="+Bandog.version;
            Bandog.Urls.signOut     = Bandog.Urls.appEngine+"sign?action=signout&extret=OK&ver="+Bandog.version;
            Bandog.Urls.contacts    = Bandog.Urls.appEngine+"contacts_list?action=get&ver="+Bandog.version;
            Bandog.Urls.send        = Bandog.Urls.appEngine+"message?action=send&ver="+Bandog.version;
            Bandog.Urls.send_status = Bandog.Urls.appEngine+"message?action=get_status&ver="+Bandog.version+'&collapse_key=';
            Bandog.Urls.messages_get= Bandog.Urls.appEngine+"sms?action=get&ver="+Bandog.version;
            Bandog.Urls.messages_get_viewed= Bandog.Urls.appEngine+"sms?action=get&status=30&from=0&to=10&ver="+Bandog.version;
            Bandog.Urls.set_status  = Bandog.Urls.appEngine+"sms?action=update_status&ver="+Bandog.version+"&status=30&id=";
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