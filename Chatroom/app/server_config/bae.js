//config file for bae
if(typeof process != 'undefined' && process.BAE){
    sumeru.config.database({
        dbname : 'your dbname'
    });
    sumeru.config({
        site_url : 'your url', //with tailing slash
    });
}