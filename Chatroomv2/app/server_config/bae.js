//config file for bae
if(typeof process != 'undefined' && process.BAE){
    sumeru.config.database({
        dbname : ''
    });
    sumeru.config({
        site_url : '', //with tailing slash
    });
}