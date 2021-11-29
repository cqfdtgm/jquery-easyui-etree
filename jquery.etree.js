/**
 * etree - jQuery EasyUI
 *
 * Licensed under the GPL:
 *   http://www.gnu.org/licenses/gpl.txt
 *
 * Copyright 2011 stworthy [ stworthy@gmail.com ]
 *
 * Dependencies:
 *   tree
 *   messager
 *
 */
(function($){
	function createTree(target){
		var opts = $.data(target, 'etree').options;

		$(target).tree($.extend({}, opts, {
			onDblClick: function(node){
				$(this).tree('beginEdit', node.target);
			},
			onBeforeEdit: function(node){
				if (opts.onBeforeEdit.call(target, node) == false) return false;
				$(this).tree('disableDnd');
			},
			onAfterEdit: function(node){
				$.ajax({
					url: opts.updateUrl,
					type: 'post',
					dataType: 'json',
					data: {
						id: node.id,
						text: node.text
					}
				});
				$(this).tree('enableDnd');
				opts.onAfterEdit.call(target, node);
			},
			onCancelEdit: function(node){
				$(this).tree('enableDnd');
				opts.onCancelEdit.call(target, node);
			},
			onBeforeDrop: function(targetNode, source, point){
				var targetId = $(target).tree('getNode', targetNode).id;
				var data = $.ajax({
					url: opts.dndUrl, type: 'post', dataType: 'json',
					async: false,       // 使用同步提交，根据返回结果决定如何处理！！
					data: { id: source.id, targetId: targetId, point: point }
				}).responseJSON;
				if (data.isError) {
				    $.messager.show(data);
				    return false;
				}
				opts.onBeforeDrop.call(target, targetNode, source, point);
			},
			onSelect: function(node) {
                if ('children' in node && 'total' in node && node.total>node.children.length) {
                    $('#pp').remove();
                    tree = this;
                    pp = $('<div id="pp" style="position:relative;top:-6px;left:200px;BBfloat:right;display:inline-block"></div>').appendTo(node.target);
                    pp.pagination({layout:['prev', 'links', 'next'], displayMsg:'', total:node.total
                        ,pageSize:node.pagesize, pageNumber: node.pageNumber
                        ,onSelectPage: function(pageNumber, pageSize) {
                            opts['queryParams']['page'] = pageNumber;
                            $(tree).tree('reload', node.target);
                            opts['queryParams']['page'] = undefined;
                            node.pageNumber = pageNumber;
                        }
                    });
                }
				opts.onSelect.call(node);
			}
           ,loadFilter: function(data) {
                if (data.d) {
                    return data.d;
                } else if (data.total) {    // 如果返回的是select形式，表明需要翻页
                    parentNode = $(this).tree('find', data.rows[0].parentid);
                    if (parentNode) {
                        parentNode.total = data.total;
                        parentNode.pagesize = data.pagesize;
                    } else {    // 是顶层目录，如果记录数超过一——显示翻页插件
                        tree = this;
                        $('#pp0').css({visibility:"visible"}).pagination({
                            total:data.total, pageSize: data.pagesize
                            ,layout: ['prev', 'links', 'next'], displayMsg:''
                            ,onSelectPage: function(pageNumber, pageSize) {
                                opts['queryParams']['page'] = pageNumber;
                                $(tree).tree('reload');
                                opts['queryParams']['page'] = undefined;
                            }
                        });
                    }
                    return data.rows;
                } else {
                    return data;
                }
            }
			,onExpand: function(node) {
			    $(this).tree('select', node.target);
			    opts.onExpand.call(node);
			}
		}));
	}

	$.fn.etree = function(options, param){
		if (typeof options == 'string'){
			var method = $.fn.etree.methods[options];
			if (method){
				return method(this, param);
			} else {
				return this.tree(options, param);
			}
		}

		options = options || {};
		return this.each(function(){
			var state = $.data(this, 'etree');
			if (state){
				$.extend(state.options, options);
			} else {
				$.data(this, 'etree', {
					options: $.extend({}, $.fn.etree.defaults, $.fn.etree.parseOptions(this), options)
				});
			}
			createTree(this);
		});
	};

	$.fn.etree.methods = {
		options: function(jq){
			return $.data(jq[0], 'etree').options;
		},
		create: function(jq){
			return jq.each(function(){
				var opts = $.data(this, 'etree').options;
				var tree = $(this);
				var node = tree.tree('getSelected');
				$.ajax({
					url: opts.createUrl,
					type: 'post',
					dataType: 'json',
					data: {
						parentId: (node ? node.id : 0)
					},
					success: function(data){
					    if (data.isError) { //如果增加不成功，返回的对象不会含id属性
					        $.messager.show(data);
					    } else {
                            tree.tree('append', {
                                parent: (node ? node.target : null),
                                data: [data]
                            });
                        }
					}
				});
			});
		},
		edit: function(jq){
			return jq.each(function(){
				var opts = $.data(this, 'etree').options;
				var node = $(this).tree('getSelected');
				if (node){
					$(this).tree('beginEdit', node.target);
				} else {
					$.messager.show({
						title:opts.editMsg.norecord.title,
						msg:opts.editMsg.norecord.msg
					});
				}
			});
		},
		destroy: function(jq){
			return jq.each(function(){
				var opts = $.data(this, 'etree').options;
				var tree = $(this);
				var node = tree.tree('getSelected');
				if (node){
					$.messager.confirm(opts.destroyMsg.confirm.title,opts.destroyMsg.confirm.msg, function(r){
						if (r){
							if (opts.destroyUrl){
								$.post(opts.destroyUrl, {id:node.id}, function(data){
								    data = JSON.parse(data);
								    if (data.isError) {
									    $.messager.show(data);
									} else {
                                        tree.tree('remove', node.target);
									}
								});
							} else {
								tree.tree('remove', node.target);
							}
						}
					});
				} else {
					$.messager.show({
						title:opts.destroyMsg.norecord.title,
						msg:opts.destroyMsg.norecord.msg
					});
				}
			});
		}
	};

	$.fn.etree.parseOptions = function(target){
		var t = $(target);
		return $.extend({}, $.fn.tree.parseOptions(target), {
			createUrl: (t.attr('createUrl') ? t.attr('createUrl') : undefined),
			updateUrl: (t.attr('updateUrl') ? t.attr('updateUrl') : undefined),
			destroyUrl: (t.attr('destroyUrl') ? t.attr('destroyUrl') : undefined),
			dndUrl: (t.attr('dndUrl') ? t.attr('dndUrl') : undefined)
		});
	};

	$.fn.etree.defaults = $.extend({}, $.fn.tree.defaults, {
		editMsg:{
			norecord:{
				title:'Warning',
				msg:'No node is selected.'
			}
		},
		destroyMsg:{
			norecord:{
				title:'Warning',
				msg:'No node is selected.'
			},
			confirm:{
				title:'Confirm',
				msg:'Are you sure you want to delete?'
			}
		},

		dnd:true,
		url:null,	// return tree data, or {total:total, pagesize:pagesize, rows:[data..]} if multi-page.
		createUrl:null,	// post parentId, return the created node data{id,text,...}, or {isError:true, msg:errorMsg, msg:msg}
		updateUrl:null,	// post id,text, return updated node data.
		destroyUrl:null,	// post id, return {success:true}, or {isError:true, msg, title}
		dndUrl:null	// post id,targetId,point, return {success:true}, or {isError:true, msg, title}
	});
})(jQuery);