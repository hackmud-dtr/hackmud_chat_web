function MessageList(channel, ul, user) {
	this.channel = channel;
	this.ul = ul;
	this.messages = {};
	this.ids = [];
	this.user = user;
	this.mentions = 0;
	this.unread = false;
	this.isAutocolor = false;

	let self = this;
	this.ul.on('scroll', function () { self.checkLoad() } );
}

MessageList.prototype.loadMore = function() {
	let self = this;
	this.channel.older().then(function(data) {
		let recent = data.chats[self.user.name].filter(m => m.channel && m.channel == self.channel.name && !self.messages[m.id]);

		if (recent.length > 0) {
			self.recordMessage(recent, true);

			self.checkLoad();
		}
	});
}

MessageList.prototype.checkLoad = function() {
	if (this.isAtTop()) {
		this.loadMore();
	}
}

MessageList.prototype.poll = function() {
	return this.channel.poll().then(messages => {
	});
}

MessageList.prototype.send = function(msg) {
	this.scrollToBottom();

	if(msg.length > 1000 || (msg.indexOf('\n') > -1 && msg.match(/\n/g).length > 10)) {
		this.write('Messages may contain no more than 1000 characters and 10 lines.');
	} else {
		if (this.isAutocolor) {
			msg = this.autoColorMsg(msg);
		}

		return this.channel.send(msg);
	}
}

MessageList.prototype.tell = function(user,to_user,msg) {
	this.scrollToBottom();

	if (this.isAutocolor) {
		msg = this.autoColorMsg(msg);
	}

	return user.tell(to_user,msg);
}
MessageList.prototype.addUnread=function() {
	this.unread = true;
	this.li.attr('data-unread', this.unread);
	this.user.updateInteresting();
}
MessageList.prototype.clearUnreads=function() {
	this.unread = false;
	this.li.removeAttr('data-unread');
	this.user.updateInteresting();
}
MessageList.prototype.addMention=function() {
	this.mentions++;
	this.li.attr('data-mention', this.mentions);
	this.li.attr('data-mention-text', this.mentions > 9 ? "+" : this.mentions);
	this.user.updateInteresting();
}
MessageList.prototype.clearMentions=function() {
	this.mentions=0;
	this.li.removeAttr('data-mention');
	this.li.removeAttr('data-mention-text');
	this.user.updateInteresting();
}

MessageList.prototype.isAtTop = function() {
	return this.ul.scrollTop() <= 0;
}

MessageList.prototype.recordMessage = function (msg, prepend) {
	let at_bottom = this.ul[0].scrollHeight - this.ul.scrollTop() == this.ul.height();
	let at_top = this.isAtTop();
	let previousHeight = this.ul[0].scrollHeight;

	let msgs = Array.isArray(msg) ? msg : [msg];

	msgs.forEach(m => {
		let id = m.id;
		this.messages[id] = m;
		this.ids.push(id);

		let classList = ['message'];
		if (settings.ignore_list.includes(m.from_user)) {
			classList.push('ignore');
		}
		if(m.msg.match(new RegExp('@'+this.user.name+'\\b'))) {
			classList.push('mention');
			this.addMention();
		}
		if(m.to_user==this.user.name)
			this.addMention();
		this.addUnread();
		this.write(formatMessage(m), classList, prepend);
	});

	if (prepend && at_top) {
		this.scrollTo(this.ul[0].scrollHeight - previousHeight);
	} else if (!prepend && at_bottom) {
		this.scrollToBottom();
	}
}

MessageList.prototype.autoColorMsg = function(msg) {
	let colored = msg.match(/([a-zA-Z])([1-3]?)/g);
	colored = colored.map(v => {
		let s = !v[1] ? "▀" : "▁▃▅"[parseInt(v[1])-1];
		s = v[0] === "M" ? "█" : s;
		return `\`${v[0]}${s}\``;
	});

	return colored.join("");
}

MessageList.prototype.write = function(html, classArray, prepend) {
	if (!classArray) {
		classArray = [];
	}

	let li = $('<li class="' + classArray.join(' ') + '">');
	li.html(html);

	if (prepend) {
		this.ul.prepend(li);
	} else {
		this.ul.append(li);
	}
}

MessageList.prototype.safeWrite = function(str, classArray) {
	this.write(escapeHtml(str), classArray);
}

// putting this on the MessageList class so that we have a way to output data
MessageList.prototype.handleSlashCommand = function(str) {
	var components = str.split(' ');

	if (components[0] == 'help') {
		this.safeWrite('Commands: /help, /ignore <user>, /color <letter|color code|none>, /tell <user> <optional message>, /users');
		if (!settings.skip_help) {
			$("input").attr("placeholder", null)
			settings.setSkipHelp(true);
		}
	} else if (components[0] == 'ignore') {
		if (components[1]) {
			var user = components[1];
			settings.addIgnore(user);
			this.safeWrite("Ignored " + user);
		} else {
			this.safeWrite("Ignore list: " + settings.ignore_list.join(", "));
		}
	} else if (components[0] == 'z') {
		this.isAutocolor = !this.isAutocolor;
		this.safeWrite(this.isAutocolor.toString());
	} else if (components[0] == 'color') {
		if (components[1]) {
			if(/^[a-z0-5]$/i.test(components[1])) {
				var color = components[1];
				settings.setColor(color);
				this.write('Set chat color to "' + color + '". Sample: "' + colorCallback(null, color, 'foo bar baz') + '"');
			}
			else if (components[1] == 'none') {
				settings.setColor('none');
				this.write('Chat color cleared. Sample: "foo bar baz"');
			}
			else {
				this.write('Invalid color code. Please specify a single letter or a number in the range 0-5. Use "/color none" to unset.');
			}
		} else {
			if (settings.color_code) {
				var color = settings.color_code;
				this.write('Current chat color is "' + color + '". Use "/color none" to unset. Sample: "' + colorCallback(null, color, 'foo bar baz') + '"');
			} else {
				this.safeWrite("Currently using the default chat color.");
			}
		}
	} else if (components[0] == 'tell') {
		if (components[1]) {
			var u=components[1];
			if(!this.user.tells[u]) {
				this.user.tells[u]={}
				setupChannel(this.user,this.user.chan_ul,this.user.user_div,u,true);
			}
			$('.channel_tab').removeClass('active');
			this.user.tells[u].list.li.addClass('active');

			$('.channel_area').hide();
			this.user.tells[u].list.channel_div.show();

			this.user.tells[u].list.scrollToBottom();
			$(this.user.tells[u].list.channel_div).find('input').focus()
			if(components[2]) {
				components.shift()
				components.shift()
				var m=components.join(' ');
				this.user.tells[u].list.tell(this.user,u,m);
			}
		} else {
			this.safeWrite("Please specify a user to open a conversation with");
		}
	} else if (components[0] == 'users') {
		// not using safe-write here but usernames can't have HTML so it is ok
		this.channel.users.sort();
		var u=this.channel.users;
		var max=Math.max.apply(null,u.map(u=>u.length))+1
		u=u.map(u=>"<pre class='nobreak'>"+u+"&nbsp;".repeat(max-u.length)+"</pre>");
		this.write("<span class='break'>"+u.join(' ')+"</span>");
	}

	this.scrollToBottom();
}

MessageList.prototype.pgUp = function() {
	let height = this.ul.height();
	let currTop = this.ul.scrollTop();

	this.ul.scrollTop(currTop - height);
}

MessageList.prototype.pgDn = function() {
	let height = this.ul.height();
	let currTop = this.ul.scrollTop();

	this.ul.scrollTop(currTop + height);
}

MessageList.prototype.scrollToBottom = function() {
	this.ul.scrollTop(1e10); // just scroll down a lot
}

MessageList.prototype.scrollTo = function(location) {
	this.ul.scrollTop(location);
}
