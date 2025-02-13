CREATE DATABASE online_chess;

USE online_chess;

-- Tables
CREATE TABLE users(
	id INT auto_increment primary key,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255)
);

create table user_info (
	user_id int,
	user_rank enum('beginner', 'intermediate','advanced', 'expert') default 'beginner',
	user_points int default 1000,
	key userID(user_id),
	constraint userID foreign key(user_id) references users(id) on delete cascade
);

CREATE TABLE games(
	id INT auto_increment primary key,
    timer VARCHAR(2),
    moves TEXT NOT NULL,
    user_id_light INT,
    user_id_black INT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY userID_Light(user_id_light),
    constraint userID_Light foreign key(user_id_light) references users(id) on delete cascade,
      KEY userID_Black(user_id_black),
    constraint userID_Black foreign key(user_id_black) references users(id) on delete cascade
);

-- Procedures
delimiter $$
create procedure createUser(	
	in _username varchar(255),
    in _email varchar(255),
    in _password varchar(255)
)
begin
	declare userId int;
    
    insert into users(username,email,password) values (_username,_email,_password);
    select id into userId from users where username = _username;
    insert into user_info(user_id) value(userId);
end $$ 
delimiter ;

DELIMITER $$
CREATE PROCEDURE updateScores(
	IN username_1 VARCHAR(255),
    IN points_1 INT,
    IN username_2 VARCHAR(255),
    IN points_2 INT
)
BEGIN
	DECLARE userId_1 INT;
    DECLARE userId_2 INT;
    DECLARE user_rank_1 VARCHAR(20) DEFAULT "beginner";
    DECLARE user_rank_2 VARCHAR(20) DEFAULT "beginner";
    
    SELECT id INTO userId_1 FROM users WHERE username=username_1;
    SELECT id INTO userId_2 FROM users WHERE username=username_2;
    
	IF points_1 < 2000 then 
		SET user_rank_1 :="beginner";
	 ELSEIF points_1 < 3000 then 
	SET user_rank_1 :="intermediate";
	 ELSEIF points_1 < 4000 then 
	SET user_rank_1 :="advanced";
    ELSE
		SET user_rank_1 :="expert";
        END IF;
	END$$
DELIMITER ;

-- Queries
select * from users;








