/**
 *
 * @author     ganxun
 * @version    1.0
 *
 */

sumeru.router.add(
	{
		pattern: '/chatchannel',
		action: 'App.todos'
	}

);

sumeru.router.setDefault('App.todos');

App.todos = sumeru.controller.create(function(env, session){	
	var getMsgs = function(){		
		if(!session.get('tag')){
            session.set('tag', 'all');
        }
    	
       session.messages = env.subscribe('pub-todos',session.get('tag'), function(msgCollection){         
           msgCollection.addSorters("time","DESC");
            //manipulate synced collection and bind it to serveral view blocks.
            session.bind('todos', {
                data    :  msgCollection.find(),
                isAllChecked : msgCollection.find({completed : false}).length == 0,
                isChecked : msgCollection.find({completed : true}).length > 0,
                unCompleted : msgCollection.find({completed : false}).length,
                commpleted: msgCollection.find({completed : true}).length
            });         
        });		
	};
   		
	//onload is respond for handle all data subscription
    env.onload = function(){   	
	   	return [getMsgs];        
    };

    //sceneRender is respond for handle view render and transition
    env.onrender = function(doRender){    
        doRender('todos', ['push', 'left']);
    };
    
    //onready is respond for event binding and data manipulate
    env.onready = function(){    	
    	var event = 'click';
        var test;	
    	var keyboardMap = {
        	'enter' : 13
    	};
    	
    	var getId = function(id){return document.getElementById(id)};
    	
    	session.event('todos', function(){    		
	    	session.eventMap('#new-todo', {
                'keydown' : function(e){
                    if(e.keyCode == keyboardMap.enter){
                        addTodos();
                    }
                },

                'focus' : function(e){
                    session.messages.hold();
                },

                'blur' : function(e){
                    if (this.value.trim() == '') {
                        session.messages.releaseHold();
                    };
                }
            });
            	
            document.getElementById('toggle-all').addEventListener(event,toggleAll);

            document.getElementById('main').addEventListener(event, function(e){
                var e = e || window.event,
                    target = e.target || e.srcElement;

                if(target.tagName.toLowerCase() == 'button' && target.hasAttribute('data-id')){
                    var smr_id = target.getAttribute('data-id');
                    session.messages.destroy({smr_id : smr_id});
                    session.messages.save();
                }

                if(target.tagName.toLowerCase() == 'input' && target.hasAttribute('data-id') && target.hasAttribute('status')){
                    var smr_id = target.getAttribute('data-id');
                    var status = target.getAttribute('status');

                    if(status){
                        session.messages.update({completed : false},{smr_id : smr_id});
                    }else{
                        session.messages.update({completed : true},{smr_id : smr_id});
                    }

                    session.messages.save();
                }

            });

            document.getElementById('footer').addEventListener(event, function(e){
                var e = e || window.event,
                    target = e.target || e.srcElement;

                if(target.tagName.toLowerCase() == 'button'){
                    session.messages.destroy({completed: true});
                    session.messages.save();
                }

                if(target.tagName.toLowerCase() == 'li' && target.hasAttribute('tag')){
                    var tag = target.getAttribute('tag');

                    if(tag == "all"){
                        session.set('tag', "all");
                        session.commit();
                    }

                    if(tag == "active"){
                        session.set('tag', "active");
                        session.commit();
                    }

                    if(tag == "completed"){
                        session.set('tag', "completed");
                        session.commit();
                    }
                }

            });
    			    		
    	});
    };
    
   	var toggleAll = function(){   	
   		if(document.getElementById('toggle-all').checked){	
   			var toggle = document.getElementsByClassName('toggle');
            	
    		for(var i=0; i< toggle.length;i++){
    			todosCompleted(toggle[i].value);	
    		};
   			
   		}else{	
   			var toggle = document.getElementsByClassName('toggle');
            	
    		for(var i=0; i< toggle.length;i++){     			
    			todosUnCompleted(toggle[i].value);	
    		};
   		}
   		   		
	}; 
    
   	var addTodos = function(){
        var input = document.getElementById('new-todo'),
            inputVal = input.value.trim();
        
        if (inputVal == '') {
           return false; 
        };
        
        session.messages.add({
            task : inputVal,
            completed: false            
        });
        session.messages.save();

        input.value = '';
        session.messages.releaseHold(); 
	};
    
  	//删去已经完成的任务
  	var deleteTodos = function(todo_time){
  		session.messages.destroy({time: 'todo_time'});	  		
  		session.messages.save();
  	}; 
  
  	//将任务的状态改成“完成”
  	var todosCompleted = function(todo_time){	
		todo_time = todo_time - 0;	  	  	
  		session.messages.update({completed: true},{time: todo_time});  	
 		session.messages.save();
  	};
  
  	//将任务的状态改成“未完成”
	var todosUnCompleted = function(todo_time){  	
  		todo_time = todo_time - 0;	  	  	
 		session.messages.update({completed: false},{time: todo_time});  	
  		session.messages.save();
  	}
       
});
	

