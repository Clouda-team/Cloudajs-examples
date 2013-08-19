Model.chatRoomModel = function(exports){
	exports.config = {
		fields : [
			{name:'username',type:'string'},
			{name: 'content', type: 'text'},
			{name: 'time', type: 'datatime',defaultValue: 'now()'},
			{name:'tag',type:'string'},
			{name:'channelname',type:'string'}
		]
	};
};