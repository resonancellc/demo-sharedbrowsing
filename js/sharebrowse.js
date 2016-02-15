(function(){
    
    var sessionOwner = true;//detect who is owner, this allows onwer to hang up on visitor.
    var inSession = false;//detect when user is in session to allow sharing
    var tm;//check url timeout.

    var urlargs         = urlparams();
    var number          = urlargs.number || Math.floor(Math.random()*999+1);
    
    var my_link = location.href.split('?')[0] + '?call=' + number;
    $("#myCallLink").text(my_link);

    // Get URL Params
    function urlparams() {
        var params = {};
        if (location.href.indexOf('?') < 0) return params;

        PUBNUB.each(
            location.href.split('?')[1].split('&'),
            function(data) { var d = data.split('='); params[d[0]] = d[1]; }
        );

        return params;
    }
    // Request fresh TURN/STUN servers from XirSys
    function get_xirsys_servers() {
        var servers;
        $.ajax({
            type: 'POST',
            url: 'https://service.xirsys.com/getIceServers',
            data: {
                room: 'default',
                application: 'default',
                domain: 'www.thedomainyoucreated.com',
                ident: 'yourxirsysident',
                secret: 'secret-token-from-xirsys-dash',
            },
            success: function(res) {
                res = JSON.parse(res);
                if (!res.e) servers = res.d.iceServers;
            },
            async: false
        });
        return servers;
    }
    //Connect Local user
    function login() {
        var phone = window.phone = PHONE({
            number        : number,
            publish_key   : 'pub-c-your-pubnub-publish-key',
            subscribe_key : 'sub-c-your-pubnub-subscribe-key',
            onaddstream   : addRemoteVideo,//add custom handling for remote users video.
            ssl           : true
        });
        //called when the local user connection is established with the service. 
        phone.ready( function(){
            // Auto Call - if the URL has a call argument to another user, initiate the call right away.
            if ('call' in urlargs) {
                var id = urlargs['call'];
                console.log("calling remote id:"+id);
                sessionOwner = false;
                makeCall(id);
            }
            //set local user camera.
            $("#videoSelf").attr( "src", window.URL.createObjectURL(phone.mystream) );
        });
        //When the remote user is ready to chat we set the call back functions 
        phone.receive(function(session){
            session.ended( sessionEnd );
            session.message(onReceiveMsg);
        });
        // When we connect to the other user start the session. 
        phone.callstatus(function(obj){
            var status = obj.status;
           switch( status ){
                case "connected":
                    sessionStart();
                    break;
            } 
        });
    }
    //We are now in a session, this will enable all the interface to allow sharing of URL's
    function sessionStart(){
        console.log("sessionStart");
        $("#urlInput").prop("disabled", false);
        $("#callLinkView").hide();
        $("#sharedWin").css( "height", $("#winContainer").css("height") );
        inSession = true;
    }
    //Our session has ended, this will hide and disable all sharing capabilities and show our connection URL again.
    function sessionEnd(){
        console.log("sessionEnd");
        $("#urlInput").val("");
        $("#urlInput").prop("disabled", true);
        setSharedView( "" );
        $("#sharedWin").css( "height", 100+"%" );
        $("#callLinkView").show();
        $("#failInfo").hide();
        if(tm) clearTimeout(tm);
        inSession = false;
    }
    //When we receive the URL message display the domain path that is being shared.
    function onReceiveMsg( session, msg ) {
        if('url' in msg){
            var path = msg.url;
            if(path.indexOf("http://") == -1 && path.indexOf("https://") == -1 ) path = "http://"+path;
            setSharedView(path);
        }
    }
    //Send a message to the other user.
    function sendMsg(objMsg){
        console.log("sending: ",objMsg);
        phone.send(objMsg);
        return true;
    }
    //Adds the remote users video feed to our remote video window.
    function addRemoteVideo( obj ){
        $("#videoRemote").attr( "src", window.URL.createObjectURL(obj.stream) );
    }
    //Request to connect to Remote User
    function makeCall( remoteId ){
        if (!window.phone) alert("Login First!");
        else if( !remoteId ) alert("The call id is missing or invalid!");
        else phone.dial( remoteId, get_xirsys_servers() );
    }
    //updates the iframe with the url path.
    function setSharedView( path ){
        $("#infoLable").text(path);
        $("#sharedWin").attr('src', path);
        $("#failInfo").hide();
        if(path != "") check();
    }

    //if URL did not resolve show message.
    function check(){
        if(tm) clearTimeout(tm);
        tm = setTimeout(function(){ $("#failInfo").show(); }, 3000);
    }

    //Listener for our URL field to share.
    $("#urlInput").keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if( keycode == "13"){
            var urlPath = $(this).val();
            setSharedView( "" );
            if( urlPath.indexOf("http://") == -1 && urlPath.indexOf("https://") == -1 ) urlPath = "http://"+urlPath;
            var b = sendMsg({url:urlPath});
            if( b ) setSharedView( urlPath );
        }
    });
    //Listener for the Hang up function. This only works if this is your show (your room).
    $("#vidRemoteContainer").click(function(){
        if( !sessionOwner || !inSession ) return;
        if (!window.phone) return;
        phone.hangup();
    });
    //Listener for showing and hiding the Hang Up icon on remote user.
    $("#vidRemoteContainer").hover(function(){
        if( !sessionOwner || !inSession ) return;
        $("#endBtn").show();
    },function(){
        $("#endBtn").hide();
    });
    //If we have our Room Number, lets log in with it.
    if( number ){
        login();
    }

})();