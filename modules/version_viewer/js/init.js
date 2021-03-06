/*jshint browser: true*/
/*global jQuery, Drupal */
(function($) {
  $(document).ready(function() {
    $('body').click(function(){
      // Hide any active tooltips (sometimes they do not clear).
      Drupal.versionViewer.tooltips.hideTooltips();
    });
    // Setup the initial menu 'look'.

    $('#wb_image').addClass('img_selected');
    $('#wb_reading').addClass('img_selected');

    // Initilize our layout per versionable obj type.
    switch (Drupal.settings.versionable_object_viewer.mode) {
      case "audio":
        $('#wb_show_til').hide();
        $('#wb_show_til').removeClass('annos');
        break;
      case "video":
        $('#wb_show_til').hide();
        $('#wb_show_til').removeClass('annos');
        break;
    }

    var is_toggled = true;

    // jQuery EasyUI tree controller.
    // Use this to control image anotations.
    $("#easyui_tree").tree({
      onCheck: function(node, checked) {
        var nodes = (node['attributes']['root'] ? node['children'] : []);
        if (nodes.length == 0) {
          nodes.push(node);
        }
        if (checked) {
          show_annotations(nodes);
        }
        else {
          hide_annotations(nodes);
        }
      },
      onClick: function(node) {
        if (node.checked) {
          $("#easyui_tree").tree('uncheck', node.target);
        }
        else {
          $("#easyui_tree").tree('check', node.target);
        }
      }
    });

    // Setup handler to show all annotations.
    $("#easyui_tree_show_annotations").click(function() {
      toggle_displayed_annotations('check');
    });

    // Setup handler to hide all annotations link.
    $("#easyui_tree_hide_annotations").click(function() {
      toggle_displayed_annotations('uncheck');
    });

    function toggle_displayed_annotations(check_or_uncheck) {
      var anno_selected = $('#wb_show_annos').hasClass('img_selected');
      var tei_selected = $('#wb_show_til').hasClass('img_selected');
      var $tree = $("#easyui_tree");

      if (anno_selected) {
        var ddt = $tree.tree('find', 'tree_imageannotations');
        var dda = $tree.tree('find', 'tree_entities');
        if (ddt) {
          $tree.tree('expandAll', ddt.target);
          $.each(ddt['children'], function (index, child) {
            var node = $tree.tree('find', child.id);
            $tree.tree(check_or_uncheck, node.target);
          });
        }
        if (dda) {
          $tree.tree('expandAll', dda.target);
          $.each(dda['children'], function (index, child) {
            var node = $tree.tree('find', child.id);
            $tree.tree(check_or_uncheck, node.target);
          });
        }
      }

      if (tei_selected) {
        var til = $tree.tree('find', 'tree_textimagelinks');
        if (til) {
          $tree.tree('expandAll', til.target);
          $.each(til['children'], function (index, child) {
            var node = $tree.tree('find', child.id);
            $tree.tree(check_or_uncheck, node.target);
          });
        }
      }
    }

    function update_tree_data() {
      var pageNumber = $('#ui-easy-paginator').pagination('options').pageNumber;
      var dpid = Drupal.settings.versionable_object_viewer.tei_rdf_pids[pageNumber - 1];
      var pid = Drupal.settings.versionable_object_viewer.pids[pageNumber - 1];
      var version_pid = Drupal.settings.versionable_object_viewer.version_pid;
      $.ajax({
        url: Drupal.settings.basePath + 'islandora/object/' + pid + '/get_tree_data/' + dpid + '/' + version_pid,
        async: false,
        success: function(data, status, xhr) {
          Drupal.versionViewer.tooltips.destroyTooltips();
          $('#easyui_tree').tree({
            data: data,
            formatter: function (node) {
              // Insert the annotation color into the tree display to cover
              // where the tree icon file is currently displayed.
              if (node.attributes.cwrcType == 'textimagelink' || node.attributes.cwrcType == 'imageannotation') {
                return '<span style="display: inherit; position: relative; right: 35px; width: 16px; height: 16px; background-color: '+ node.attributes.color + ';"></span><span style="position: relative;right: 16px; vertical-align: top;">' + node.text + '</span';
              }
              else {
                return node.text;
              }
            }
          });
          add_tooltip_imageannotations();

          // XXX: Add tooltips for entities and text image annotations into
          // the tree.  Used in place of putting the tooltips in the text.
          add_tree_tooltips_for_entities_and_text_image_annotations();

          // Check to see if text-image or entities transcript styles need to be
          // hidden on page change.
          if (!$('#wb_show_annos').hasClass('annos')) {
            var dda = $("#easyui_tree").tree('find', 'tree_entities');
            if (dda !== null) {
              hide_transcription_styles(dda['children']);
            }
          }

          if (!$('#wb_show_til').hasClass('annos')) {
            var ddt = $("#easyui_tree").tree('find', 'tree_textimagelinks');
            if (ddt !== null) {
              hide_transcription_styles(ddt['children']);
            }
          }

          // Resize content.
          $('#eui_window').layout('resize', {
            width: '100%'
          });
          if (data[0] !== undefined) {
            data[0]['children'].forEach(function (info) {
              $("span[data-annotationid='" + info.id + "']").addClass(info['attributes']['cwrcType']);
            });
          }
        },
        error: function(data, status, xhd) {
        }
      });
    }

    $('#ui-easy-paginator').pagination({
      onSelectPage: function(pageNumber, pageSize) {
        Drupal.versionViewer.tooltips.destroyTooltips();
        $('#easyui_tree').tree({
          data: []
        });
        
        show_transcription(pageNumber);
        
        update_tree_data();
      }
    });

    function show_annotations(nodes) {
      // Hide any active tooltips (sometimes they do not clear).
      Drupal.versionViewer.tooltips.hideTooltips();
      if (nodes.length > 0 && nodes[0]['attributes']['urn']) {
        for (var i = 0; i < nodes.length; i++) {
          var anno_id = nodes[i]['attributes']['urn'].replace("urn:uuid:", "");
          paint_commentAnnoTargets(null, 'canvas_0', anno_id, nodes[i]['attributes']['type']);
        }
      }
      else {
        for (var i = 0; i < nodes.length; i++) {
          var ent_id = nodes[i]['attributes']['annotationId'];
          if (nodes[i]['attributes']['anchorType'] == 'offset') {
            var start = nodes[i]['attributes']['offsets']['start'];
            var end = nodes[i]['attributes']['offsets']['end'];
            var get_offset_element = function (offset) {
              var selector = '.tei .line-magic .' + offset['element'] + "[data-" + offset['id_attribute'].toLowerCase() + "='" + offset['id'] + "']";
              return document.querySelector(selector);
            };

            // Get start offset_id
            var start_element = get_offset_element(start);
            var end_element = get_offset_element(end);

            var find_text_node_at_offset = function (element, offset) {
              var info = {
                remaining: offset,
                node: null
              };
              function getTextNodesIn(node) {
                var textNodes = [];
                function getTextNodes(node) {
                  if (node.nodeType == Node.TEXT_NODE) {
                    textNodes.push(node);
                  } else {
                    for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                      getTextNodes(node.childNodes[i]);
                    }
                  }
                }
                getTextNodes(node);
                return textNodes;
              }
              var text_nodes = getTextNodesIn(element);
              $(text_nodes)
                .filter(function (element) {
                  return this.nodeType == Node.TEXT_NODE && this.data != ' ';
                })
                .each(function(index, element) {
                  if (info.remaining >= this.data.length) {
                    info.remaining -= this.data.length;
                  }
                  else {
                    info.node = this;
                    return false;
                  }
                });
              // In some cases of overlay text highlighting it's not setting the
              // end node properly when the selected text stops at the end of a
              // node. To handle these cases by setting the data at the loop to
              // the last element.
              if (info.node == null && info.remaining === 0) {
                // Catch issues where it's not setting the end node.
                info.node = $(text_nodes).last().get(0);
                info.remaining = info.node.length;
              }
              return info;
            };

            // Custom handle overlap tooltips and "painting".
            // Find and split "start" node.
            var start_info = find_text_node_at_offset(start_element, start['offset']);
            var start_suffix = start_info.remaining == start_info.node.length ?
              start_info.node :
              start_info.node.splitText(start_info.remaining);
            // Find and split "end" node.
            var end_info = find_text_node_at_offset(end_element, end['offset']);
            // Split text nodes.
            var end_suffix = end_info.remaining == end_info.node.length ?
              null :
              end_info.node.splitText(end_info.remaining);

            // Tag relevant text nodes between the start and end elements
            // (exclusive).
            var found_start = false;
            var found_end = false;
            var temp_linked_overlaps = [];
            var linked_overlaps = [];
            // No nice way to recursively consider text nodes...
            var unique = $.unique($('.tei .line-magic *')
              .contents()
              .get());
            $(unique)
              .filter(function (index, element) {
                if (this.nodeType != Node.TEXT_NODE) {
                  return false;
                }
                if (this == start_suffix) {
                  found_start = true;
                  return true;
                }
                else if (start_suffix && this == end_info.node) {
                  found_end = true;
                  return true;
                }
                else {
                  return found_start && !found_end;
                }
              })
              .each(function(){
                var parents = $.unique($(this).parent('span.overlap-spanning-annotation:not(.tooltip-f)').get());
                $(parents).each(function(){ temp_linked_overlaps.push($(this).prop("className").replace(" ", ".")); });;
              })
              .wrap('<span class="overlap-spanning-annotation ' + ent_id + '"></span>');
            temp_linked_overlaps = $.unique(temp_linked_overlaps);
            // Associate the linked_overlaps with current overlap.
            for (var index in temp_linked_overlaps) {
              if (temp_linked_overlaps[index]) {
                var tooltip_selector = temp_linked_overlaps[index].replace(" ", ".");
                linked_overlaps.push(tooltip_selector);
                // Get current data and append to it.
                var data_overlap_attr = $('overlap-spanning-annotation.' + ent_id).attr('data-linked-overlaps');
                var current_overlaps = [];
                if (typeof data_overlap_attr !== typeof undefined && data_overlap_attr !== false) {
                  var current_overlaps = data_overlap_attr.split(",");
                }
                current_overlaps.push('overlap-spanning-annotation.' + ent_id);
                $("span." + tooltip_selector).attr('data-linked-overlaps', current_overlaps.join());
              }
            }

            $('span.overlap-spanning-annotation.' + ent_id)
              .addClass('v-viewer-' + nodes[i]['attributes']['cwrcType'])
              .addClass(get_entity_class(nodes[i]['attributes']['cwrcType']))
              .attr('data-linked-overlaps', linked_overlaps.join());

            show_entity_tooltip(nodes[i]['attributes'], ent_id);

            var checked = $("#easyui_tree").tree('getChecked');
            for (var j = 0; j < checked.length; j++) {
              if (checked[j]['attributes']['annotationId'] == start['id'] || checked[j]['attributes']['annotationId'] == end['id']) {
                var tooltips_elements = [];
                if (checked[j]['attributes'].hasOwnProperty('nestedTooltips')) {
                  tooltips_elements = checked[j]['attributes']['nestedTooltips'];
                }
                if (!$.inArray('span.overlap-spanning-annotation.' + ent_id, tooltips_elements)) {
                  tooltips_elements.push('span.overlap-spanning-annotation.' + ent_id);
                }
                var temp_attributes = checked[j]['attributes'];
                temp_attributes['nestedTooltips'] = tooltips_elements;
                $("#easyui_tree").tree('update', {
                  target: checked[j].target,
                  attributes: temp_attributes
                });
                // Reset the parent entity to have it update the tooltip code.
                var selector = ".tei *[data-annotationid='" + checked[j]['attributes']['annotationId'] + "']";
                $(selector).off();
                show_entity_tooltip(checked[j]['attributes'], checked[j]['attributes']['annotationId']);
              }
            }
          }
          $("span[data-annotationid='" + ent_id + "']").addClass('v-viewer-' + nodes[i]['attributes']['cwrcType']);
          show_entity_tooltip(nodes[i]['attributes'], ent_id);
          if (nodes[i]['attributes']['cwrcType'] == 'textimagelink') {
            var anno_id = nodes[i]['attributes']['cwrcAttributes']['attributes']['uuid'].replace("urn:uuid:", "");
            paint_commentAnnoTargets(null, 'canvas_0', anno_id, "comment");
          }
          if (nodes[i]['attributes']['cwrcType'] == 'imageannotation') {
            var anno_id = nodes[i]['attributes']['uuid'];
            paint_commentAnnoTargets(null, 'canvas_0', anno_id, "comment");
          }
        }
      }
    }
    /**
     * Retrieve the CWRC_Writer tei class
     * representaiton of this entity type.
     */
    function get_entity_class(cwrc_type) {
      // The cwrc_writer uses specific CSS class names
      // to style entities in TEI that dont match the defined
      // entity type in the JSON. So, we must find
      // there match.
      var entity_class = "";
      switch(cwrc_type) {
        case "person":
          entity_class = "persName"
          break;
        case "place":
          entity_class = "placeName"
          break;
        case "organization":
          entity_class = "orgName"
          break;
        case "title":
          entity_class = "title"
          break;
        case "textimagelink":
          // DGI made this one, so it does match.
          entity_class = cwrc_type;
          break;
      }
      return entity_class;
    }
    function hide_annotations(nodes) {
      // Hide any active tooltips (sometimes they do not clear).
      Drupal.versionViewer.tooltips.hideTooltips();

      if (nodes.length > 0 && nodes[0]['attributes']['urn']) {
        for (var i = 0; i < nodes.length; i++) {
          var anno_id = nodes[i]['attributes']['urn'].replace("urn:uuid:", "");
          if (can_remove_svg(anno_id)) {
            $('.svg_' + anno_id).remove();
          }
        }
      }
      else {
        // Hide Entities.
        for (var i = 0; i < nodes.length; i++) {
          var ent_id = nodes[i]['attributes']['annotationId'];
          // Because the HTML gets manipulated / removed we have to destroy our
          // tooltip as it's data will be gone.
          Drupal.versionViewer.tooltips.destroyEntityTooltip(ent_id);
          Drupal.versionViewer.dialogs.destroyEntityDialog(ent_id, nodes[i]['attributes']);
          if (nodes[i]['attributes']['anchorType'] == 'offset') {
            $('span.overlap-spanning-annotation.' + ent_id)
              .css('text-decoration', 'inherit')
              .contents()
              .unwrap();

            var checked = $("#easyui_tree").tree('getChecked');
            for (var j = 0; j < checked.length; j++) {
              if (checked[j]['attributes']['annotationId'] == nodes[i]['attributes']['offsets']['start']['id'] || checked[j]['attributes']['annotationId'] == nodes[i]['attributes']['offsets']['start']['id']) {
                if (checked[j]['attributes'].hasOwnProperty('nestedTooltips')) {
                  var tooltips_elements = checked[j]['attributes']['nestedTooltips'];
                  var value = 'span.overlap-spanning-annotation.' + ent_id;
                  for (var index in tooltips_elements) {
                    if (tooltips_elements[index] == value) {
                      tooltips_elements.splice(index, 1);
                      break;
                    }
                  }
                  var temp_attributes = checked[j]['attributes'];
                  temp_attributes['nestedTooltips'] = tooltips_elements;
                  $("#easyui_tree").tree('update', {
                    target: checked[j].target,
                    attributes: temp_attributes
                  });
                }
              }
            }
          }
          var selector = "span[data-annotationid='" + ent_id + "']";
          $(selector).removeClass('v-viewer-' + nodes[i]['attributes']['cwrcType']);
          // Clear all click and tooltip events.
          $(selector).off();
          if (nodes[i]['attributes']['cwrcType'] == 'textimagelink') {
            var anno_id = nodes[i]['attributes']['cwrcAttributes']['attributes']['uuid'].replace("urn:uuid:", "");
            if (can_remove_svg(anno_id)) {
              $('.svg_' + anno_id).remove();
            }
          }
          if (nodes[i]['attributes']['cwrcType'] == 'imageannotation') {
            var anno_id = nodes[i]['attributes']['uuid'];
            if (can_remove_svg(anno_id)) {
              $('.svg_' + anno_id).remove();
            }
          }
        }
      }
    }

    /**
     * Creates a tooltip/dialog for the given entity.
     *
     * @param {Object} entity An object containing the entity data.
     * @param {String} entID The identifier of the given entity.
     */
    function show_entity_tooltip(entity, entID) {
      var tooltips = Drupal.versionViewer.tooltips;
      var dialogs = Drupal.versionViewer.dialogs;
      if (tooltips.canDisplayEntity(entity)) {
        if (tooltips.entityHasTooltip(entID)) {
          // Because creating new entities destroys spans we have to recreate
          // tooltips even when others are being shown.
          tooltips.destroyEntityTooltip(entID);
        }
        tooltips.createEntityTooltip(entID, entity);
      }
      if (dialogs.canDisplayEntity(entity)) {
        if (dialogs.entityHasDialog(entID)) {
          dialogs.destroyEntityDialog(entID, entity);
        }
        dialogs.createEntityDialog(entID, entity);
      }
    }

    function build_dialog_content(data) {
      var content = "";
      for (var key in data["cwrcAttributes"]) {
        if (typeof data["cwrcAttributes"][key] !== "object") {
          content += key + ": " + data["cwrcAttributes"][key] + '&#13;&#10;';
        }
        else {
          var obj_key_string = "";
          for (var obj_key in data["cwrcAttributes"][key]) {
            obj_key_string += obj_key + ": " + data["cwrcAttributes"][key][obj_key] + '&#13;&#10;';
          }
          content += obj_key_string;
        }
      }
      return  '<textarea style="width:100%;height:100%;resize:none">' + content + '</textarea>';
    }

    function show_transcription(page) {
      var type;
      var url;
      $('.work_action_img').not('.image').not('.detail-meta').not('.switch').each(function(){
        if ($(this).is('.img_selected')) {
          var elem_id = $(this).attr('id');
          switch (elem_id) {
            case "wb_tei_markup":
              type = "mk";
              var pid = Drupal.settings.versionable_object_viewer.tei_rdf_pids[page - 1];
              // URL endpoint is pretty different, so need to set it here.
              url = Drupal.settings.basePath + 'islandora/version_viewer/tei_markup/page/' + pid;
              break;

            case "wb_reading":
              type = "rd";
              break;

            case "wb_dt":
              type = "dt";
              break;

          }
        }
      });

      if (typeof url === 'undefined'){
        url = Drupal.settings.versionable_object_viewer.trans_url + '?page=' + page + '&type=' + type;
      };

      if (type == 'dt') {
        add_tab("wb_dt_tab", url, 'diplomatic_tei');
      }
      else if (type == 'rd'){
        add_tab("wb_reading_tab", url, 'reading_tei');
      }
      else {
        add_tab("wb_tei_markup", url, '');
      }
      advance_shared_canvas_page(page);
    }

    function advance_shared_canvas_page(page) {
      $.ajax({
        url: Drupal.settings.basePath + 'islandora/anno/setup/'
            + Drupal.settings.versionable_object_viewer.pids[page - 1],
        async: false,
        success: function(data, status, xhr) {
          islandora_canvas_params = data;
          continueSetup();
        },
        error: function(data, status, xhd) {
          alert(Drupal.t("Please Login to site"));
        },
        dataType: 'json'
      });
    }

    $('#eui_window').layout('collapse', 'south');

    $('.work_action_img').click(function() {
      var is_selected = false;
      if ($(this).hasClass('img_selected')) {
        $(this).removeClass('img_selected');
        is_selected = false;
      }
      else {
        $(this).addClass('img_selected');
        is_selected = true;
      }

      var pageNumber = $('#ui-easy-paginator').pagination('options').pageNumber;
      switch ($(this).attr('id')) {
        case 'wb_meta':
          $('#wb_meta').removeClass('img_selected');

          $('#wb_meta').addClass('img_selected');
          toggle_layout(is_selected, 'south', 'wb_meta');
          // Change the window size based on if the easyui is fullscreen or not.
          if ($('#eui_window').hasClass('eui-window-fullscreen')) {
            // Use window height and subtract 50px for the menu bar display.
            var height = $(window).height() - 54;
            $('#eui_window').layout('panel', 'south').panel('resize', {height: height});
          } else {
            $('#eui_window').layout('panel', 'south').panel('resize', {height: '656'});
          }
          break;
        case 'wb_dt':
          $('#wb_reading').removeClass('img_selected');
          $('#wb_tei_markup').removeClass('img_selected');
          $('#wb_dt').removeClass('img_selected');
          $('#wb_tei_markup').removeClass('img_selected');

          $('#wb_dt').addClass('img_selected');
          var url = Drupal.settings.versionable_object_viewer.trans_url + '?page=' + (pageNumber) + '&type=dt';
          add_tab("wb_dt_tab", url, 'diplomatic_tei');
          break;
        case 'wb_image':
//          $('#wb_image').removeClass('img_selected');
//          $('#wb_image').addClass('img_selected');
          toggle_layout(is_selected, 'east', 'wb_image');
          break;
        case 'wb_reading':
          $('#wb_dt').removeClass('img_selected');
          $('#wb_tei_markup').removeClass('img_selected');
          $('#wb_reading').removeClass('img_selected');

          $('#wb_reading').addClass('img_selected');
          var url = Drupal.settings.versionable_object_viewer.trans_url + '?page=' + (pageNumber) + '&type=rd';
          add_tab("wb_reading_tab", url, 'reading_tei');
          break;
        case 'wb_tei_markup':
          $('#wb_reading').removeClass('img_selected');
          $('#wb_meta').removeClass('img_selected');
          $('#wb_dt').removeClass('img_selected');
          $('#wb_tei_markup').removeClass('img_selected');
          $('#wb_tei_markup').addClass('img_selected');
          var pid = Drupal.settings.versionable_object_viewer.tei_rdf_pids[pageNumber - 1];
          var url = Drupal.settings.basePath + 'islandora/version_viewer/tei_markup/page/' + pid;
          add_tab("wb_tei_markup_tab", url, "", "json", true);
          break;
        case 'wb_show_annos':
          var ddt = $("#easyui_tree").tree('find', 'tree_imageannotations');
          var dda = $("#easyui_tree").tree('find', 'tree_entities');

          if ($(this).hasClass('annos')) {
            $(this).removeClass('annos');
            $(this).removeClass('img_selected');
            if (ddt) {
              $('#' + ddt.domId).hide();
              if (ddt['children'].length > 0) {
                hide_tree_children(ddt['children']);
              }
            }
            if (dda) {
              $('#' + dda.domId).hide();
              if (dda['children'].length > 0) {
                hide_tree_children(dda['children']);
                hide_transcription_styles(dda['children']);
              }
            }
          }
          else {
            $(this).addClass('annos');
            $('#wb_show_annos').addClass('img_selected');
            if (ddt) {
              $('#' + ddt.domId).show();
              if (ddt['children'].length > 0) {
                show_tree_children(ddt['children']);
              }
            }
            if (dda) {
              $('#' + dda.domId).show();
              if (dda['children'].length > 0) {
                show_tree_children(dda['children']);
                show_transcription_styles(dda['children']);
              }
            }
          }
          break;
        case 'wb_show_til':
          var ddt = $("#easyui_tree").tree('find', 'tree_textimagelinks');
          if ($(this).hasClass('annos')) {
            $(this).removeClass('annos');
            $(this).removeClass('img_selected');
            if (ddt) {
              $('#' + ddt.domId).hide();
              if (ddt['children'].length > 0) {
                hide_tree_children(ddt['children']);
                hide_transcription_styles(ddt['children']);
              }
            }
          }
          else {
            $(this).addClass('annos');
            $('#wb_show_til').addClass('img_selected');
            if (ddt) {
              $('#' + ddt.domId).show();
              if (ddt['children'].length > 0) {
                show_tree_children(ddt['children']);
                show_transcription_styles(ddt['children']);
              }
            }
          }
          break;
      }
      // This crazy bit of logic opens/closes the annotations window, given the correct conditions.
      if ($('#wb_show_til').hasClass('annos') == false && $('#wb_show_annos').hasClass('annos') == false) {
        $('#eui_window').layout('collapse', 'west');
        is_toggled = true;
      }
      else {
        if (is_toggled == true) {
          is_toggled = false;
          $('#eui_window').layout('expand', 'west');
        }
      }
    });

    function hide_tree_children(children) {
      for (var i = 0; i < children.length; i++) {
        $("#" + children[i].domId).hide();
      }
      children = $("#easyui_tree").tree('getChecked');
      hide_annotations(children);
    }

    function show_tree_children(children) {
      for (var i = 0; i < children.length; i++) {
        $("#" + children[i].domId).show();
      }
      children = $("#easyui_tree").tree('getChecked');
      show_annotations(children);
    }

    function hide_all_imageannotations() {
      var node = $("#easyui_tree").tree('find', 'tree_imageannotations');
      hide_annotations($(node).children());
    }

    function add_tab(type, endpoint, add_class, data_type) {
      add_class = typeof add_class !== 'undefined' ? add_class : "";
      data_type = typeof data_type !== 'undefined' ? data_type : "json";
      $.ajax({
        type: 'GET',
        async: false,
        dataType: data_type,
        url: endpoint,
        success: function(data, status, xhr) {
          construct_tab(data, type);
          if (add_class != "") {
            $('#' + type).addClass(add_class);
          }
          // Resize with new content.
          $('#eui_window').layout('resize', {
            width: '100%'
          });
          update_tree_data();
          try {
            Drupal.attachBehaviors();
          } catch(e) {
            console.log(e);
          }
        },
        error: function(xhRequest, ErrorText, thrownError) {
          console.log(ErrorText + ":" + thrownError);
        }
      });
    }

    function construct_tab(data, type) {
      Drupal.versionViewer.tooltips.destroyTooltips();
      $('#easyui_tree').tree({
        data: []
      });
      $('#center_data').empty();
      $('#center_data').append(data['body']);
      prettyPrint();
    }

    function toggle_layout(selected, region, selector) {
      if (!selected) {
        $('#eui_window').layout('collapse', region);
        $('#' + selector).removeClass('img_selected');
        if (selector == "wb_show_annos") {
          var ddt = $("#easyui_tree").tree('find', 'tree_textimagelinks');
          $('#' + ddt.domId).show();
        }
      }
      else {
        $('#eui_window').layout('expand', region);
        $('#' + selector).addClass('img_selected');
        if (selector == "wb_show_annos") {
          var ddt = $("#easyui_tree").tree('find', 'tree_textimagelinks');
          $('#' + ddt.domId).hide();
        }
      }
    }

    function add_tooltip_imageannotations() {
      var node = $("#easyui_tree").tree('find', 'tree_imageannotations');
      if (node) {
        var children = node['children'];
        var data = "";
        for (var i = 0; i < children.length; i++) {
          data = children[i]['attributes'];
          var tool_tip_content = data['title'];
          if (data['cwrcInfo'].hasOwnProperty('description')) {
            tool_tip_content = data['cwrcInfo']['description'];
          }
          $("#" + children[i].domId).tooltip({
            position: 'right',
            content: '<div class="easyui-panel" style="width:250px;height:\'auto\';padding:10px;">' + tool_tip_content + '</div>'
          }).show();
        }
      }
    }

    /**
     * Add tree tooltips for entities and text image annotations.
     */
    function add_tree_tooltips_for_entities_and_text_image_annotations() {
      var nodes = new Array();
      var entities = $("#easyui_tree").tree('find', 'tree_entities');
      if (entities) {
        nodes.push(entities);
      }
      var text_image_links = $("#easyui_tree").tree('find', 'tree_textimagelinks');
      if (text_image_links) {
        nodes.push(text_image_links);
      }
      for (var a = 0; a < nodes.length; a++) {
        var children = nodes[a]['children'];
        for (var i = 0; i < children.length; i++) {
          var data = children[i]['attributes']['cwrcAttributes'];
          var tool_tip_content = null;
          if (data['cwrcInfo'].hasOwnProperty('description')) {
            tool_tip_content = data['cwrcInfo']['description'];
          }
          if (tool_tip_content) {
            $("#" + children[i].domId).tooltip({
              position: 'right',
              content: '<div class="easyui-panel" style="width:250px;height:\'auto\';padding:10px;">' + tool_tip_content + '</div>'
            }).show();
          }
        }
      }
    }

    var pageNumber = $('#ui-easy-paginator').pagination('options').pageNumber;
    var url = Drupal.settings.versionable_object_viewer.trans_url + '?page=' + (pageNumber);

    // Show our first tab.
    add_tab("wb_reading_tab", url, "reading_tei");

    // Callback to fix the drawing of SVG annotations upon resize.
    var cleanDrawSVGAnnotations = function() {
      var nodes_to_redraw = [];
      var children = $("#easyui_tree").tree('getChecked');
      hide_annotations(children);
      // Trim down the children list and only show the checked ones that
      // need to be redrawn based on if the show is enabled for that text image
      // or image annotions/entities.
      for (var j = 0; j < children.length; j++) {
        if (children[j]['attributes']['cwrcType'] == 'textimagelink' && $('#wb_show_til').hasClass('annos')) {
            nodes_to_redraw.push(children[j]);
        }
        else if (children[j]['attributes']['cwrcType'] == 'imageannotation' && $('#wb_show_annos').hasClass('annos')) {
          nodes_to_redraw.push(children[j]);
        }
      }
      show_annotations(nodes_to_redraw);
    };

    // Hide transcription styles for node elements (text color and borders).
    function hide_transcription_styles(nodes) {
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j]['attributes']['anchorType'] != 'offset') {
          $("span[data-annotationid='" + nodes[j]['attributes']['annotationId'] + "']").addClass('clear-transcript-text');
        }
      }
    }

    // Show transcription styles for node elements (text color and borders).
    function show_transcription_styles(nodes) {
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j]['attributes']['anchorType'] != 'offset') {
          $("span[data-annotationid='" + nodes[j]['attributes']['annotationId'] + "']").removeClass('clear-transcript-text');
        }
      }
    }

    // Check that the svg needs to be removed
    function can_remove_svg(svg_anno) {
      var nodes = $("#easyui_tree").tree('getChecked');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i]['attributes']['cwrcType'] == 'textimagelink') {
          var anno_id = nodes[i]['attributes']['cwrcAttributes']['attributes']['uuid'].replace("urn:uuid:", "");
          if (anno_id == svg_anno && $('#wb_show_til').hasClass('annos')) {
            return false;
          }
        }
        else if (nodes[i]['attributes']['cwrcType'] == 'imageannotation') {
          var anno_id = nodes[i]['attributes']['uuid'];
          if (anno_id == svg_anno && $('#wb_show_annos').hasClass('annos')) {
            return false;
          }
        }
      }
      return true;
    }

    $('#easy-ui-east').panel({
      onResize: function(w, h) {
        var mode = Drupal.settings.versionable_object_viewer.mode;
        if (mode == "text" || mode == "image") {
          // @see emicdora/modules/version_viewer/js/islandora_image_annotation_init.js.
          resizeCanvas(cleanDrawSVGAnnotations);
        }
      }
    });

    $('#center_data').panel({
      onResize: function(w, h) {
        var mode = Drupal.settings.versionable_object_viewer.mode;
        if (mode == "text" || mode == "image") {
          // @see emicdora/modules/version_viewer/js/islandora_image_annotation_init.js.
          resizeCanvas(cleanDrawSVGAnnotations);
        }
      }
    });

    // On initial page load remove all annotations from the tree.
    var image_annotations = $("#easyui_tree").tree('find', 'tree_imageannotations');
    var entities = $("#easyui_tree").tree('find', 'tree_entities');
    var textimage = $("#easyui_tree").tree('find', 'tree_textimagelinks');

    if (image_annotations) {
      $('#' + image_annotations.domId).hide();
      if (image_annotations['children'].length > 0) {
        hide_tree_children(image_annotations['children']);
      }
    }
    if (entities) {
      $('#' + entities.domId).hide();
      if (entities['children'].length > 0) {
        hide_tree_children(entities['children']);
      }
    }
    if (textimage) {
      $('#' + textimage.domId).hide();
      if (textimage['children'].length > 0) {
        hide_tree_children(textimage['children']);
      }
    }

    $('#eui_window').layout('panel','west').panel({
      onClose:function(){
        // Need to manually trigger the resize update panel
        // layout.
        $('.layout-panel-center').css({left: 5});
        $('#eui_window').layout('resize', {
          width: '100%',
          height: '729px'
        });
      }
    });
  });
})(jQuery);
