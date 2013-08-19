Model.chatChannelModel = function(exports){
	exports.config = {
		fields : [
			{name:'channelname',type:'string'},
			{name: 'time', type: 'datatime',defaultValue: 'now()'},
			{name:'describe',type:'string',defaultValue:''}
		]
	};
};