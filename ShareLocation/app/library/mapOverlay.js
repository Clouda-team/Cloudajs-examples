/**
 * Created by yunlong on 13-12-11.
 */
Library.mapOverlay = sumeru.Library.create(function(exports){

    exports.createRole = function(roleData){
        var role = function(roleData){
            var me = this;
            var bm;

            var getUserIdentity = function(){
                return me.dataSource.name || me.dataSource.userId;
            }

            var isSelf = function(){
                return me.dataSource.userId === Library.generateId.getUserId();
            }

            var isTarget = function(){
                return me.dataSource.userId === "target";
            }

            var polyline;
            var marker;
            var BMapPointArr = [];

            this.dataSource = roleData;

            this.getBMapPointArr = function(update){
                if(update || 0 == this.BMapPointArr.length) {
                    var locationPointArr = this.dataSource.coordinate || [];
                    locationPointArr.forEach(function(item){
                        BMapPointArr.push(new BMap.Point(item.lng,item.lat));
                    });
                }

                return BMapPointArr;
            };

            this.setMap = function(map){
                bm = map;
            };

            this.run = function(){
                var allBMapPoint = this.getBMapPointArr(true);
                if(0 == allBMapPoint.length){
                    return;
                }

                polyline = new BMap.Polyline(allBMapPoint, {strokeColor:"blue", strokeWeight:3, strokeOpacity:0});
                bm.addOverlay(polyline);

                var myIcon;
                var opt = {};
                var labelgps = new BMap.Label(getUserIdentity(),{offset:new BMap.Size(20,-10)});
                switch (this.dataSource.roleStatus) {
                    case 'cry':
                    {
                        myIcon = new BMap.Icon('./assets/pic/cry2.png',new BMap.Size(66,61));
                        opt.icon = myIcon;
                        labelgps = new BMap.Label("大家快点哦，等到花都谢了！",{offset:new BMap.Size(20,-10)});
                        break;
                    }
                    default :
                    {
                       opt = {};
                    }
                }

                var currentPoint = allBMapPoint[allBMapPoint.length - 1];
                marker = new BMap.Marker(currentPoint,opt);

                bm.addOverlay(marker); //添加标注
                marker.setLabel(labelgps); //添加标注

                if(isTarget()) {
                    marker.setAnimation(BMAP_ANIMATION_BOUNCE)
                }

                if(isSelf()) {
                    bm.panTo(currentPoint);
                }
            }

            this.clear = function(){
                bm.removeOverlay(marker);
                bm.removeOverlay(polyline);
            }
        };

        return new role(roleData);
    };

    exports.createRoleController = function(){
        var me = this;
        var roleController = function(){
            var rolePool = [];

            this.init = function(usersInfo){
                usersInfo.forEach(function(item){
                    rolePool.push(me.createRole(item));
                },this);
            };

            this.updateRolesData = function(usersInfo){
                this.removeAllRoles();
                this.init(usersInfo);
            };

            this.removeAllRoles = function(){
                rolePool.forEach(function(item){
                    item.clear();
                    item = null;
                });
                rolePool = [];
            };

            this.run = function(map){
                rolePool.forEach(function(item){
                    item.setMap(map);
                    item.run();
                });
            }

        }

        return new roleController();
    }

    return exports;
});
