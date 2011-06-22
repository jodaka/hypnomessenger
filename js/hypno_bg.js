"use strict";  // voices in my head forced me to write this

var Hypno = {
    params: {
        debug  : false,
        version: -1
    },

    auth_and_reg: false,    // this flag shows that we have
                            // Auth (on google) and Registration on Android

    // console.log wrapper then only spams in debug mode
    log: function(o) {
        if (Hypno.params.debug&&window.console&&console.log) {
            console.log(o);
        }
    },
    // console.log wrapper then only spams in debug mode
    warn: function(o) {
        if (window.console&&console.warn) {
            console.warn(o);
        }
    },
    // console.log wrapper then only spams in debug mode
    error: function(o) {
        if (window.console&&console.error) {
            console.error(o);
        }
    },

    Init: function(params) {
        Hypno.params  = params;

        // initializing urls
        Hypno.Urls.Init();

        // clean dialogs cache
        window.localStorage.removeItem('Hypno_dialog_cache');

        // add listener to communicate with popup page
        chrome.extension.onRequest.addListener(
            function(request, sender, sendResponse) {

                if (!request.hasOwnProperty('action')) {
                    Hypno.log('UI: request without action detected. Ignoring');
                    return false;
                }

                switch(request.action) {
                case 'bg_send_sms':
                    Hypno.Messages.Send(request.data);
                    break;

                case 'bg_mark_as_read':
                    Hypno.Messages.MarkAsRead(request.data);
                    break;

                case 'bg_log':
                    if (request.hasOwnProperty('type')) {
                        switch (request.type) {
                        case 'info':
                            Hypno.log(request.data);
                            break;
                        case 'warn':
                            Hypno.warn(request.data);
                            break;
                        case 'error':
                            Hypno.error(request.data);
                            break;
                        }
                    } else {
                        Hypno.warn('Got log request without type definition:');
                        Hypno.warn(request.data);
                    }
                    break;

                case 'bg_reload_messages':
                    Hypno.Messages.Load();
                    break;

                case 'bg_load_dialog':
                    Hypno.Messages.LoadDialog(request.cid);
                    break;

                case 'bg_reload_data':
                    Hypno.Contacts.Load();
                    Hypno.Messages.Load();
                    break;

                case 'bg_signout':
                    Hypno.Actions.Signout();
                    break;

                case 'bg_checkAuthReg':
                    Hypno.Actions.checkAuthAndReg();
                    break;

                case 'bg_dialog_inactive':
                    Hypno.Contacts.active_dialog = false;
                    break;

                case 'bg_dialog_active':
                    Hypno.Contacts.active_dialog = request.data;
                    break;

                default:
                    Hypno.log('ENGINE: ~~~> got signal '+request.action);
                    break;
                }
            }
        );

        chrome.browserAction.setPopup({
            popup: "hypno_gui.html"
        });

        // get user email and fio
        jQuery.when(
            jQuery.ajax({
                            url: Hypno.Urls.status,
                            dataType: 'json'
                        })
        ).done(
            function(res) {
                if (!(typeof(res) === "object" && res.hasOwnProperty('status'))) {
                    Hypno.warn(res);
                    return false;
                }
                // check status
                Hypno.Actions.checkStatus(res.status);
                // save username and email
                Hypno.params.userid     = res.email;
                Hypno.params.username   = res.nickName;
                Hypno.params.userkey    = '123456789'; // TO BE FIXED one day  // TODO FIXME
                if (Hypno.auth_and_reg) {
                    Hypno.Contacts.Load();
                    Hypno.ws.init();
                }
                return true;
            });
        return true;
    },

    Actions: {
        // this function is called from gui
        // every time a popup is open
        // it just check then we have auth and reg
        checkAuthAndReg: function() {
            jQuery.ajax({
                url: Hypno.Urls.status,
                dataType: 'json',
                complete: function(res) {
                    var json;
                    try {
                        json = eval('('+res.responseText+')');  // obj = this.getResponseJSON();
                    } catch (err) {
                        Hypno.warn(err);
                        return false;
                    }
                    Hypno.Actions.checkStatus(json.status);
                    return true;
                }
                        });
        },

        checkStatus: function(status) {
            var result = false;
            switch (status) {
            case 'OK':
                var stored_status = window.localStorage.getItem('Hypno_status');
                if (stored_status != 'ok' || !Hypno.auth_and_reg) {
                    Hypno.Actions.Registered();
                }
                result = true;
                break;

            case 'DEVICE_NOT_REGISTERED':
                Hypno.Actions.DeviceNotRegistered();
                break;

            case 'SIGNIN_REQUIRED':
                Hypno.Actions.NotAuthorized();
                Hypno.Actions.Signout();
                break;

            default:
                Hypno.error('ENGINE: UNKNOWN STATUS '+status);
            }
            return result;
        },

        Signout: function() {
            Hypno.log('ENGINE: Signout called. All data cleared');
            Hypno.Notifications.Icon('auth');
            window.localStorage.setItem('Hypno_status', 'auth');
            Hypno.Messages.list = {
                incoming: [],
                outgoing: [],
                history : [],
                viewed  : []
            };
            window.localStorage.setItem('Hypno_messages_incoming', JSON.stringify(Hypno.Messages.list.incoming));
            window.localStorage.setItem('Hypno_messages_outgoing', JSON.stringify(Hypno.Messages.list.outgoing));
            window.localStorage.setItem('Hypno_messages_viewed', JSON.stringify(Hypno.Messages.list.viewed));
            window.localStorage.setItem('Hypno_messages_history', JSON.stringify(Hypno.Messages.list.history));

            Hypno.Contacts.list = [];
        },

        MessageSent: function(request) {
            Hypno.Messages.Store();
            chrome.extension.sendRequest({action: 'ui_message_sent'});
        },

        NewMessagesAvailable: function() {
            window.localStorage.setItem('Hypno_status', 'ok');
            //Hypno.log('ENGINE: ++ NewMessagesAvailable fired');
            if (Hypno.Messages.list.incoming && Hypno.Messages.list.incoming.length > 0) {
                Hypno.Notifications.Icon('new', Hypno.Messages.list.incoming.length);
            } else {
                Hypno.Notifications.Icon('clear');
            }
        },

        DeviceNotRegistered: function() {
            Hypno.log('ENGINE: ... DEVICE_NOT_REGISTERED');
            Hypno.auth_and_reg = false;
            Hypno.Notifications.Icon('register');
            window.localStorage.setItem('Hypno_status', 'device_not_registered');
            chrome.extension.sendRequest({action: 'ui_not_registered'});
            // clear event listeners
            chrome.browserAction.onClicked.listeners = [];
        },

        Registered: function() {
            Hypno.log('ENGINE: ... DEVICE_REGISTERED');
            Hypno.auth_and_reg = true;
            Hypno.Notifications.Icon('new', Hypno.Messages.list.incoming.length);
            window.localStorage.setItem('Hypno_status', 'ok');
            chrome.extension.sendRequest({action: 'ui_registered'});
        },

        NotAuthorized: function() {
            Hypno.log('ENGINE: ... SIGNIN_REQUIRED');
            Hypno.auth_and_reg = false;
            Hypno.Notifications.Icon('auth');
            window.localStorage.setItem('Hypno_status', 'auth');

            // clear event listeners
            chrome.browserAction.onClicked.listeners = [];
        }
    },

    Notifications: {
        desktop_popup: false,

        // Shows desktop notification
        Popup: function(msg) {
            if (!msg) return 0; // we only display usefull popups :)

            if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED

                Hypno.Notifications.desktop_popup = window.webkitNotifications.createNotification(
                    'img/icon_120.png',
                    chrome.i18n.getMessage('_new_sms_notify'),
                    msg
                );
                Hypno.Notifications.desktop_popup.show();

                // remove notification
                setTimeout(function(){
                               Hypno.Notifications.desktop_popup.cancel();
                               Hypno.Notifications.desktop_popup = false;
                           }, 4000);

            } else {
                window.webkitNotifications.requestPermission();
            }
            return true;
        },

        Icon: function(action, msg) {
            //Hypno.log('ENGINE: Notify.Icon called action='+action);
            if (action == 'new') {
                chrome.browserAction.setIcon({path: "img/icon_18.png"});
                // don't draw 0 sms
                if (msg === 0) {
                    chrome.browserAction.setBadgeText({text: ''});
                    return 1;
                }
                chrome.browserAction.setBadgeText({text: String(msg)});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_new_messages')});
            }
            if (action == 'auth') {
                chrome.browserAction.setIcon({path: "img/icon_18_disabled.png"});
                chrome.browserAction.setBadgeText({text: 'A'});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_authorization_fail')});
            }
            if (action == 'register') {
                chrome.browserAction.setIcon({path: "img/icon_18_disabled.png"});
                chrome.browserAction.setBadgeText({text: '!'});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_not_registered')});
            }
            if (action == 'clear') {
                chrome.browserAction.setIcon({path: "img/icon_18.png"});
                chrome.browserAction.setBadgeText({text: ''});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_new_messages')});
            }
            return true;
        }
    },

    Messages: {
        iniated: false,
        //incoming_timer: false,
        list: {
            incoming: [],
            outgoing: [],
            viewed  : [],
            history : []
        },

        LoadDialog: function(cid) {

            var contact = Hypno.Contacts.list[Hypno.Contacts.FindById(cid)];
            var phones  = [];
            if (contact && contact.phones && contact.phones.length > 0) {
                for (var i = contact.phones.length-1; i >= 0; i--) {
                    phones.push(contact.phones[i].number);
                }
            }
            var phones_numbers = phones.join(',');

            // Drawing messages
            jQuery.when(
                jQuery.ajax({
                                url: Hypno.Urls.messages.get.unread+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                                dataType: 'json'
                            }),
                jQuery.ajax({
                                url: Hypno.Urls.messages.get.outgoing+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
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

                       window.localStorage.setItem('Hypno_dialog', JSON.stringify(from));
                       chrome.extension.sendRequest({action: 'ui_reload_dialog', cid: cid});
                   });

        },

        Load: function(){

            if (!Hypno.Messages.iniated) {
                // load cache
                Hypno.Messages.list = {
                    incoming: JSON.parse(window.localStorage.getItem('Hypno_messages_incoming')),
                    outgoing: JSON.parse(window.localStorage.getItem('Hypno_messages_outgoing')),
                    viewed  : JSON.parse(window.localStorage.getItem('Hypno_messages_viewed')),
                    history : []
                };
                Hypno.Messages.iniated = true;
            }

            jQuery.when(
                jQuery.ajax({
                                url: Hypno.Urls.messages.get.unread+'&status=0',
                                dataType: 'json'
                            })
            ).done(function(ajax_new_list){
                       if (!Hypno.Actions.checkStatus(ajax_new_list['status'])) {
                           Hypno.warn('ENGINE: status FAIL');
                           return false;
                       }

                       var new_sms = ajax_new_list.sms_list.slice();
                       Hypno.Actions.NewMessagesAvailable();

                       // generating virtual contacts
                       Hypno.Contacts.GenerateVirtualContacts(new_sms);
                       window.localStorage.setItem('Hypno_contacts', JSON.stringify(Hypno.Contacts.list));

                       // handling of new messages
                       if (JSON.stringify(Hypno.Messages.list.incoming) != JSON.stringify(new_sms)) {
                           Hypno.Messages.list.incoming = new_sms.slice();
                           window.localStorage.setItem('Hypno_messages_incoming', JSON.stringify(Hypno.Messages.list.incoming));

                           // generating virtual contacts
                           Hypno.Contacts.GenerateVirtualContacts();
                           window.localStorage.setItem('Hypno_contacts', JSON.stringify(Hypno.Contacts.list));

                           Hypno.Actions.NewMessagesAvailable();
                           chrome.extension.sendRequest({action: 'ui_reload_messages'});
                           chrome.extension.sendRequest({action: 'ui_reload_contacts'});
                       }
                       return true;
                   });
        },

        Store: function() {
            window.localStorage.setItem('Hypno_messages_incoming',  JSON.stringify(Hypno.Messages.list.incoming));
            window.localStorage.setItem('Hypno_messages_viewed',    JSON.stringify(Hypno.Messages.list.viewed));
            window.localStorage.setItem('Hypno_messages_outgoing',  JSON.stringify(Hypno.Messages.list.outgoing));
            window.localStorage.setItem('Hypno_messages_history',   JSON.stringify(Hypno.Messages.list.history));
        },

        /*
         Receive a list of messages ids and move them from list to copy2list
         */
        RemoveById: function(id_arr) {
            var list = Hypno.Messages.list.incoming;
            for (var a = 0, max = id_arr.length; a < max; a++) {
                for (var l = 0, max2 = list.length; l < max2; l++) {
                    if (list[l].id == id_arr[a]) {
                        list.splice(l, 1);
                        break;
                    }
                }
            }
            return list;
        },

        MarkAsRead: function(id_arr) {
            // we can mark all messages as read if pass any string instead of array
            if (id_arr.constructor != Array ) {
                id_arr = [];
                var list = Hypno.Messages.list.incoming;
                for (var i = 0, max = list.length; i < max; i++) {
                    if (list[i].hasOwnProperty('id') && list[i].status != 30)
                        id_arr.push(list[i].id);
                }
            } else {
                Hypno.log('UI: Marking as read id='+id_arr.join(','));
            }

            jQuery.ajax({
                            url: Hypno.Urls.messages['set']['read']+id_arr.join(','),
                            dataType: 'json',
                            complete: function(data) {
                                Hypno.Messages.list.incoming = Hypno.Messages.RemoveById(id_arr);
                                Hypno.Messages.Store();
                                Hypno.Notifications.Icon('new', Hypno.Messages.list.incoming.length);
                                // send signal to UI to update lists
                                chrome.extension.sendRequest({action: 'ui_reload_contacts'});
                                chrome.extension.sendRequest({action: 'ui_reload_messages'});
                            }
                        });
        },

        Send: function(msg) {
            var send_url = Hypno.Urls.send+
                '&collapse_key='+msg.collapse_key+
                '&phone_number='+msg.phone_number+
                '&message='+msg.message;

            jQuery.ajax({
                            url: send_url,
                            dataType: 'json',
                            complete: function (data) {
                                try {
                                    var json = eval('('+data['responseText']+')');
                                } catch (err) {
                                    Hypno.warn(err);
                                    return false;
                                }

                                if (Hypno.Actions.checkStatus(json.status)) {
                                    chrome.extension.sendRequest({
                                                                     action : 'ui_message_sent',
                                                                     message: {
                                                                         'collapse_key'  : msg.collapse_key
                                                                     }
                                                                 });
                                }
                                return true;
                            }
                        });

        }
    },

    Contacts: {
        list            : [],
        phones_lookup   : false,
        active_dialog   : false,

        FindById: function(id) {
            for (var i = 0, max = Hypno.Contacts.list.length; i < max; i++) {
                if (Hypno.Contacts.list[i].id == id) {
                    return i;
                }
            }
            return -1;
        },

        FindByPhone: function(phone) {
            var lookup = Hypno.Contacts.phones_lookup;

            if (!lookup) {
                lookup   = {};
                var list = Hypno.Contacts.list;
                for (var i = 0; i < list.length; i++) {
                    for (var j = 0; j < list[i].phones.length; j++) {
                        var number = list[i].phones[j].number;
                        lookup[number] = i;
                    }
                }
                Hypno.Contacts.phones_lookup = lookup;
            }
            if (!phone) return -1;
            return lookup[phone];
        },

        // this function will parse all incoming messages and search for
        // senders that are not in the contact list
        GenerateVirtualContacts: function(messages, contacts) {
            var msgs = (messages) ? messages : Hypno.Messages.list.incoming;
            var ctcs = (contacts) ? contacts : Hypno.Contacts.list;

            if (!msgs) {
                Hypno.log('Warning! no messages found. Can\'t generate virtual contacts');
                return 0;
            }

            if (!ctcs) {
                Hypno.log('Warning! no contacts found. Can\'t generate virtual contacts');
                return 0;
            }

            var virtual = {};
            /*
             contact format
             ---------------
             id   : string/number
             name : string
             phones: array[{ number: string, primary: boolean, type: int } ]
             */
            for (var i = 0; i < msgs.length; i++) {
                if (!Hypno.Contacts.FindByPhone(msgs[i].phone_number)) {
                    virtual[msgs[i].phone_number] = {
                        id  : 'virt'+i,
                        name: msgs[i].phone_number,
                        phones: [{
                                     number  : msgs[i].phone_number,
                                     primary : true,
                                     type    : 2 // could be any type here
                                 }]
                    };
                }
            }

            // saving virtual contacts
            for (var c in virtual) {
                Hypno.Contacts.list.push(virtual[c]);
                Hypno.Contacts.phones_lookup[c] = Hypno.Contacts.list.length-1;
            }

            return 1;
        },

        Load: function() {
            //Hypno.log('ENGINE: ... Contacts sending request');
            jQuery.ajax({
                            url: Hypno.Urls.contacts,
                            dataType: 'json',
                            complete: function(data) {
                                var json = {};

                                try {
                                    json = eval('('+data['responseText']+')');  // obj = this.getResponseJSON();
                                } catch (err) {
                                    Hypno.warn(err);
                                    return false;
                                }

                                if (Hypno.Actions.checkStatus(json.status)) {

                                    if (!Hypno.auth_and_reg) Hypno.Actions.Registered(); // ? do we really need this ?

                                    if (JSON.stringify(Hypno.Contacts.list) != JSON.stringify(json.contact_list)) {
                                        Hypno.log('<== got new contacts list');
                                        Hypno.Contacts.list = json.contact_list;

                                        // we need to reset contacts lookup so it will be rebuilded
                                        Hypno.Contacts.phones_lookup = false;

                                        // generating virtual contacts
                                        Hypno.Contacts.GenerateVirtualContacts();
                                        // saving contacts
                                        window.localStorage.setItem('Hypno_contacts', JSON.stringify(Hypno.Contacts.list));
                                        window.localStorage.setItem('Hypno_status', 'ok');

                                        // send signal to main window to update contacts list
                                        chrome.extension.sendRequest({action: 'ui_reload_contacts'});
                                    }

                                    // getting messages from server
                                    if (!Hypno.Messages.iniated) {
                                        Hypno.Messages.Load();
                                    }
                                }
                                return true;
                            }
                        });
        }
    },

    Urls: {
        appEngine   : false,
        signIn      : false,
        signOut     : false,
        contacts    : false,
        send        : false,
        index       : chrome.extension.getURL('close.html'),
        websocket   : {
            port: 80,
            host: false
        },

        Init: function() {
            Hypno.Urls.appEngine   = "http://"+Hypno.params.version+".latest.bandog812.appspot.com/";
            Hypno.Urls.signIn      = Hypno.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(Hypno.Urls.index)+"&ver="+Hypno.params.version;
            Hypno.Urls.signOut     = Hypno.Urls.appEngine+"sign?action=signout&extret=OK&ver="+Hypno.params.version;
            Hypno.Urls.status      = Hypno.Urls.appEngine+"sign?action=check&ver="+Hypno.params.version;
            Hypno.Urls.contacts    = Hypno.Urls.appEngine+"contacts_list?action=get&ver="+Hypno.params.version;
            Hypno.Urls.send        = Hypno.Urls.appEngine+"message?action=send&ver="+Hypno.params.version;
            Hypno.Urls.send_status = Hypno.Urls.appEngine+"message?action=get_status&ver="+Hypno.params.version+'&collapse_key=';
            Hypno.Urls.websocket.port = Hypno.params.ws_port;
            Hypno.Urls.websocket.host = Hypno.params.ws_host;

            Hypno.Urls.messages = {
                'get': {
                    unread  : Hypno.Urls.appEngine+"sms?action=get&ver="+Hypno.params.version,
                    viewed  : Hypno.Urls.appEngine+"sms?action=get&status=30&from=0&to=10&ver="+Hypno.params.version,
                    outgoing: Hypno.Urls.appEngine+'message?action=get&ver='+Hypno.params.version
                },
                'set': {
                    'read'  : Hypno.Urls.appEngine+"sms?action=update_status&ver="+Hypno.params.version+"&status=30&id="
                }
            };
        }
    },

    // websocket layer
    ws: {
        socket: false,
        debug : false,
        auth  : false,
        params: {},

        // Connection Manager. Can initiate WS connection,
        // send messages
        // and authorize client on server
        conn: {
            init: function() {
                if (Hypno.ws.socket) {
                    Hypno.log('already connected to socket');
                    return 0;
                }
                try {
                    Hypno.ws.socket = new io.Socket(Hypno.Urls.websocket.host, {
                                                        port: Hypno.Urls.websocket.port,
                                                        rememberTransport: true
                                                    });
                    Hypno.ws.socket.connect();
                } catch(e) {
                    Hypno.log('error connecting to socket');
                    Hypno.log(e);
                    return 0;
                }
                Hypno.ws.bind_handlers();     // binding response handlers
                return 1;
            },

            // checks for auth.
            // if called without params - will try to send auth request
            //
            auth: function(msg) {
                if (!msg) {
                    Hypno.log('---> sending auth request');
                    Hypno.ws.conn.send({
                                           type: 'auth',
                                           key : Hypno.params.userkey,
                                           id  : Hypno.params.userid,
                                           sid : 'websms'
                                       });
                } else {
                    if (msg.hasOwnProperty('type') && msg.type == 'auth') {
                        if (msg.data.hasOwnProperty('value') && msg.data.value) {
                            Hypno.ws.auth = true;
                            Hypno.log('Auth granted');
                        } else {
                            Hypno.ws.auth = false;
                            Hypno.log('Auth rejected');
                        }
                    } else {
                        Hypno.log('Warning: can\'t parser auth response');
                        Hypno.log(msg);
                    }
                }
            },

            // sending data to server over ws
            send: function(o) {
                try {
                    Hypno.ws.socket.send(o);
                } catch(e) {
                    Hypno.log(e);
                }
                return 1;
            }
        },

        bind_handlers: function() {
            //Hypno.log('binding handlers');
            // binding handlers
            Hypno.ws.socket.on(
                'message',
                function(msg){
                    if (msg.hasOwnProperty('type')) {
                        switch (msg.type) {
                        case 'auth':
                            Hypno.log('<--- AUTH response');
                            Hypno.ws.conn.auth(msg);
                            return 1;
                            break;

                        case 'SMS':
                            Hypno.log('<--- SMS');
                            Hypno.ws.notify.sms(msg);
                            return 1;
                            break;

                        case 'MESSAGE':
                            Hypno.log('<--- MESSAGE');
                            Hypno.ws.notify.message(msg);
                            return 1;
                            break;

                        case 'SMS_STATUS_CHANGED':
                            // do nothing;
                            break;

                        case 'MESSAGE_STATUS_CHANGED':
                            Hypno.log('<--- SMS/MSG STATUS CHANGED');
                            Hypno.ws.notify.status_update(msg);
                            break;

                        case 'CONTACT_LIST':
                            Hypno.log('<--- CONTACT_LIST');
                            Hypno.ws.notify.contact_list(msg);
                            break;

                        case 'DEVICE_REGISTERED':
                            Hypno.log('<--- DEV_REGISTERED');
                            Hypno.ws.notify.registered(msg);
                            break;

                        case 'DEVICE_NOT_REGISTERED':
                            Hypno.log('<--- DEV_NOT_REGISTERED');
                            Hypno.ws.notify.not_registered(msg);
                            break;

                        default:
                            Hypno.log('<--- unknown message');
                            Hypno.log(msg);
                            break;
                        }
                    } else {
                        Hypno.log('Warning: message doesn\'t has type. Don\'t know how to parse');
                        Hypno.log(msg);
                        return 0;
                    }
                });

            Hypno.ws.socket.on(
                'connect',
                function(){
                    Hypno.log('~~~ websocket connected');
                    Hypno.ws.conn.auth();         // requesting auth
                });

            Hypno.ws.socket.on(
                'disconnect',
                function() {
                    Hypno.log('~~~  websocket disconnected');
                    Hypno.ws.auth = false;
                });

            //Hypno.ws.socket.on('reconnect', function(){ message({ message: ['System', 'Reconnected to server']})});
            //Hypno.ws.socket.on('reconnecting', function( nextRetry ){ message({ message: ['System', 'Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms']})});
            //Hypno.ws.socket.on('reconnect_failed', function(){ message({ message: ['System', 'Reconnected to server FAILED.']})});
        },

        // handling of all notifications
        notify: {

            // handling of new sms notifications
            sms: function(msg) {
                // message data contaions phone number
                var name = msg.data;
                var cid  = Hypno.Contacts.FindByPhone(msg.data);
                if (cid > -1) {
                    name = Hypno.Contacts.list[cid].name;
                } else {
                    Hypno.warn('Haven\'t found contact for number '+msg.data);
                    // we don't have this contact in list
                    // we need to reset contacts lookup so it will be rebuilded
                    Hypno.Contacts.phones_lookup = false;
                    Hypno.Contacts.GenerateVirtualContacts();
                    cid = msg.data;
                }
                Hypno.Notifications.Popup(chrome.i18n.getMessage('_new_sms_notify_label')+' '+name);
                Hypno.Messages.Load();

                // if we got active dialog - we should update it
                if (Hypno.Contacts.active_dialog) {
                    if (Hypno.Contacts.active_dialog.indexOf(msg.data) != -1) {
                        Hypno.log(' **************** got active dialog! Reloading... for cid='+cid+' user='+msg.data);
                        var contact_id = Hypno.Contacts.list[cid].id;
                        Hypno.Messages.LoadDialog(contact_id);
                    } else {
                        Hypno.log('active dialog with '+Hypno.Contacts.active_dialog+' but sms is from '+ msg.data);
                    }
                } else {
                    Hypno.log('no active dialog found');
                }
            },

            status_update: function(msg) {
                // should we do anything on msg status change?
                Hypno.log(' ** status_update fired');
                chrome.extension.sendRequest({action: 'ui_reload_contacts'});
                chrome.extension.sendRequest({action: 'ui_reload_messages'});
                return 1;
            },

            message: function(msg) {
                // TODO FIXME
                return 1;
            },

            contact_list: function(msg) {
                Hypno.Contacts.Load();
                return 1;
            },

            registered: function(msg) {
                Hypno.Actions.Registered();
                return 1;
            },

            not_registered: function(msg) {
                Hypno.Actions.DeviceNotRegistered();
                return 1;
            }
        },

        // binding all params to global ws object
        init: function() {
            Hypno.ws.conn.init();
        }
    }
};

chrome.browserAction.setTitle({title: chrome.i18n.getMessage('name')});