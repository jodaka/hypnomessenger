// wrapper :)
var chrome = {
    extension: {
        onRequest: {
            addListener: function() {

            }
        },

        sendRequest: function(data) {
            opera.postError(data);
            try {
                opera.extension.broadcastMessage(data);
            } catch (x) {
                opera.postError(x);
            }

            opera.postError('call finished');
            return 1;
        },

        getURL: function() {
            opera.postError('getURL called');
        }
    },

    browserAction: {
        setPopup: function() {
            opera.postError('setPopup called');
        },

        setIcon: function() {
            opera.postError('setIcon called');
        },
        setBadgeText: function() {
            opera.postError('setBadgeText called');

        },
        setTitle: function() {
            opera.postError('setTitle');
        }

    },

    tabs: {
        create: function(params) {
            opera.postError('creating tabs');
            opera.extension.tabs.create({
                                            focused: true,
                                            url: params.url
                                        });

        },
        onClicked: {
            listeners: []
        }

    },

    i18n: {
        data: {},
        getMessage: function(string) {
            return chrome.i18n.data[string];
        }
    }
};
