//config file for bae
if(sumeru.BAE_VERSION){
  sumeru.config.database({
    dbname : '',
    user: '',//bae 3.0 required
    password: '',//bae 3.0 required
  }); 
  sumeru.config({
    site_url : '', //with tailing slash
  }); 

}
