# Horten MySQL

## Config

### connection 	
Either a mysql connection, or something to pass to mysql.createConnection.
					Usually in a format like { host: 'local', port: 3306, etc }



###table
The main data table.

###pathTable
The table in which to store paths. If this is defined, two tables will be created rather than one. See schema.

### history

### columns
Either an array of columns to use, or an object with the keys being Horten.MySQL internal names for columns and the values being your own names. Required columns such as **path** and **json** will be automatically added if they are not specified. See the **Columns** section for more detail.

### timeQuant



### timeOffset	
The zero point for time as recorded to the table. By default, this is `0`, which will be `time` values compatible with unix timestamp ( although divided by `timeQuant` ). Setting to `new Date()` will specify that time should start when your program does, which can be useful for repeately recording real time data.


### keepAlive
Set to false to die when the connection closes, rather than reconnecting.

### pathLength
The MySQL field size to use for paths. Default is `640`, which ought to be enough for anybody. :)

## Columns
### path
### pathId
** Required if pathTable is set. **
### json
### time

The time when the value was set, as a MySQL `BIGINT`. If `timeOffset` and `timeQuant` config values are left to their defaults, this will be unix time. Otherwise, the equation use to create this value is:

	time = new Date ( time ).getTime ();
	time = floor ( ( time - timeOffset ) / timeQuant )


### number

If specified, the `number` column will store any numeric values as a MySQL `DOUBLE`. The `json` column will not be set. 

I find that 96%+ of the data I put through Horten is numbers, so this is a big savings, especially on `history: true` tables.

### origin
The `origin` which was passed to the listener by `Horten`. This will be either `NULL` or the name of the `Listener` which made the original `set` command, which can be quite descriptive and will contain connection infomation for network interfaces.

You should use this if you need logging or debugging information, but it will add a lot for extra data when used with `history: true`. 

### method
If specified, the `method` column will be set to the method which was passed to the listener by Horten. This is fairly boring, and I don't know why it would be needed, except for debugging.




## Schema

Horten.MySQL creates its schema dynamically based on the configuration options **history**, **table**, **pathTable** and **columns**. 

Here is an example of the schema create with the optional columns **origin**, **method**, and **number**:

```
CREATE TABLE IF NOT EXISTS `table` (
	`path` varchar(640) NOT NULL, 
	`time` BIGINT DEFAULT NULL, 
	KEY `time` ( `time` ),
	`number` double DEFAULT NULL, 
	`json` text, 
	`origin` varchar(255), 
	`method` char(8), 
	PRIMARY KEY `path` (`path`) 
) ENGINE=InnoDB;
```
Here is an example of the two tables created when **pathTable** is set and **history** is enabled:

```
CREATE TABLE IF NOT EXISTS `pathTable` (
	`pathId` int(20) NOT NULL AUTO_INCREMENT,
	`path` varchar(640) NOT NULL, 
	PRIMARY KEY (`pathId`),
	UNIQUE KEY `path` (`path`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `table` (
	`pathId` int(20) NOT NULL AUTO_INCREMENT, 
	`time` BIGINT DEFAULT NULL, 
	KEY `time` ( `time` ), 
	`json` text,  
	KEY `pathId` (`pathId`) 
) ENGINE=InnoDB;
```