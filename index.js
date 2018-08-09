const
    restify = require('restify'),
    plugins = require('restify-plugins'),
    config = require('config'),
    builder = require('botbuilder'),
    apiAIRecognizer = require('api-ai-recognizer'),
    request = require('request');

const DIALOG_CLIENT_ACCESS_TOKEN = config.get('dialogFlowClientAccessToken'),
      MICROSOFT_APP_ID = config.get('microsoft_app_id'),
      MICROSOFT_APP_PASSWORD = config.get('microsoft_app_password'),
      CUSTOM_VISION_PREDICTION_KEY = config.get('custom_vision_prediction_key'),
      CUSTOM_VISION_URI = config.get('custom_vision_uri');

var recognizer = new apiAIRecognizer(DIALOG_CLIENT_ACCESS_TOKEN);
var intents = new builder.IntentDialog({recognizers:[recognizer]});

var server = restify.createServer();

server.listen(process.env.port || process.env.PORT || 3978, function(){
    console.log('%s listening to %s', server.name, server.url);
});

var connector = new builder.ChatConnector({
    appId:MICROSOFT_APP_ID,
    appPassword:MICROSOFT_APP_PASSWORD
});

var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector).set('storage',inMemoryStorage);
server.post('/api/messages', connector.listen());
bot.dialog('/', intents);

intents.matches('Is it KFC',function(session, args){
    var checkAction = builder.EntityRecognizer.findEntity(args.entities, "actionIncomplete");
    var brandName = {};
    if(checkAction.entity){
        var myFulfillment = builder.EntityRecognizer.findEntity(arg.entities, "fulfillment");
        session.send(myFulfillment.entity);
    }else{
        brandName = builder.EntityRecognizer.findEntity(args.entities, "BrandName");
        session.send("好的，馬上開始為您確認這是不是%s!",brandName.entity);
        session.send("請上傳一張圖片");
    }
});

intents.matchesAny(['Default Fallback Intent','Default Welcome Intent'],function(session,args){
    session.send("想知道這個秘密嗎？請說「我想知道這是不是肯德基」");
});

intents.matches('None', function(session, args){
    var msg = session.message;
    if(msg.attachments && msg.attachments.length>0){
        session.send("收到您的圖片了！");
        session.send("待我掐指一算...");
        var attachment = msg.attachments[0];
        processMessageImage(attachment, session);
    }
});

function processMessageImage(event, session){
    request({
        uri:CUSTOM_VISION_URI,
        json:true,
        method:"POST",
        headers:{
            "Prediction-Key":CUSTOM_VISION_PREDICTION_KEY,
            "Content-Type":"application/json"},
        body:{"Url":event.contentUrl}
    },function(error, response, body){
        if(!error && response.statusCode == 200){
            var thesePredictions = response.body.predictions;
            for(var x in thesePredictions){
                if(thesePredictions[x].tagName == "PS4"){
                    if(thesePredictions[x].probability >= 0.7){
                        session.send("我覺得這有87分像，它是肯德基!(%s)",thesePredictions[x].probability);
                    }else{
                        session.send("這不是肯德基吧 >< (%s)",thesePredictions[x].probability);
                    }
                }
            }
        }else{
            session.send("[MS Cognitive Service] failed");
        }
    });
}

