sumeru.router.add(

	{
		pattern: '/student',
		action: 'App.student'
	}

);

sumeru.router.setDefault('App.student');


App.student = sumeru.controller.create(function(env, session){
	
	var view = 'students';

	function getExt() {

        session.extStudent = env.subscribe('pubext',function(collection){

			session.bind('extBlock', {
				data : collection.find()
			});
		});

        session.bind('descBlock',{
            serverUrl: "http://" + sumeru.config.get("dataServerHost")
        });

        session.bind('sourceFrame',{
            serverUrl: "http://" + sumeru.config.get("dataServerHost")
        });
	}

	env.onload = function(){
		return [getExt];
	}
	
	env.onrender = function(doRender){
		doRender(view, ['push','right']);
	};
	
	env.onready = function(rootBlock){

		session.event('extBlock', function(){

			var delBtns = rootBlock.querySelectorAll('.del');
			var modBtns = rootBlock.querySelectorAll('.mod');
			
			Array.prototype.forEach.call(delBtns, function(delBtn){
				delBtn.onclick = function(){
					var smrid = this.getAttribute('data-smrid');
					session.extStudent.destroy({"smr_id" : smrid});
					session.extStudent.save();
				}
			});
			
			Array.prototype.forEach.call(modBtns, function(modBtn){
				modBtn.onclick = function(){
					var smrid = this.getAttribute('data-smrid');
					var val = this.parentNode.querySelector('#newAge').value;
					session.extStudent.update({"age" : parseInt(val)}, {"smr_id" : smrid});
					session.extStudent.save();
				}
			});

            var addBtn = rootBlock.querySelector('#addStudent');
            var nameInput = rootBlock.querySelector('#studentName');
            var ageInput = rootBlock.querySelector('#studentAge');

            addBtn.onclick = function(){
                if(!checkDataMaxLimit(session.extStudent)) {
                    return;
                }

                var name = nameInput.value;
                var age = ageInput.value - 0;
                session.extStudent.add({
                    name : name,
                    age : age
                });
                session.extStudent.save();
                nameInput.value = sumeru.utils.randomStr(8);
                ageInput.value = sumeru.utils.randomInt(11,30) - 0;
            }

            nameInput.value = sumeru.utils.randomStr(8);
            ageInput.value = sumeru.utils.randomInt(11,30) - 0;


            setTimeout(function(){
                var sourceFrame = rootBlock.querySelector('#sourceFrame');
                sourceFrame && (sourceFrame.src = sourceFrame.src);

                //cross domain to fetch data
                sumeru.external.get("http://" + sumeru.config.get("dataServerHost"), function(data){
                    var textarea = rootBlock.querySelector('#crossDomainGet');
                    textarea.innerHTML = data;
                });

            },300);

		});

	}

    function checkDataMaxLimit(collection){
        if(20 <= collection.length) {
            alert("The data size is too much to add new one, please try it again after delete anyone");
            return false;
        }
        return true;
    }

});