<?php

/**
 * @file
 * Handles the management of MVD.
 */

/**
 * Validate transcripts can be used for collations.
 *
 * @param array $pids
 *   An array of transcription object PIDs.
 */
function emicdora_mvd_validate_transcripts(array $pids) {
  $get_transcription_size = function($pid) {
    $object = islandora_object_load($pid);
    return isset($object['TRANSCRIPTION']) ? $object['TRANSCRIPTION']->size : -1;
  };
  $transcriptions = array_map($get_transcription_size, drupal_map_assoc($pids));
  $min = min($transcriptions);
  $max = max($transcriptions);

  $min_pids = array_keys($transcriptions, $min, TRUE);
  $min_pid = reset($min_pids);
  $min_object = islandora_object_load($min_pid);

  $max_pids = array_keys($transcriptions, $max, TRUE);
  $max_pid = reset($max_pids);
  $max_object = islandora_object_load($max_pid);

  if ($min <= 0) {
    form_set_error('transcriptions', t('The Transcription %label (%pid) is empty and can not be used to create a collation.', array(
      '%label' => $min_object->label,
      '%pid' => $min_object->id,
    )));
  }
  elseif ($max >= 102400) {
    form_set_error('transcriptions', t('The Transcription %label (%pid) with length of (%length) exceeds the maximum size (102400) and can not be used to create a collation.', array(
      '%label' => $max_object->label,
      '%pid' => $max_object->id,
      '%length' => $max,
    )));
  }
  elseif (1.0 * $min / $max < 0.1) {
    form_set_error('transcriptions', t('The Transcription(s) %label_one (%pid_one) with length of (%length_one) and %label_two (%pid_two) with length of (%length_two) can not be used to create a collation as the lengths are too different.', array(
      '%label_one' => $min_object->label,
      '%pid_one' => $min_object->id,
      '%length_one' => $min,
      '%label_two' => $max_object->label,
      '%pid_two' => $max_object->id,
      '%length_two' => $max,
    )));
  }
}

/**
 * The form for creating a MVD object.
 *
 * @param array $form
 *   The Drupal form definition.
 * @param array $form_state
 *   The Drupal form state.
 */
function emicdora_mvd_form(array $form, array &$form_state, AbstractObject $object) {
  module_load_include('inc', 'emicdora', 'includes/utilities');
  module_load_include('inc', 'emicdora', 'includes/breadcrumb');
  emicdora_set_title_and_breadcrumbs_object($object);

  $form = array();

  $form['mvd'] = array(
    '#type' => 'textfield',
    '#title' => t('Title of new Collation'),
    '#size' => 40,
    '#required' => TRUE,
  );
  $form['mvd_description'] = array(
    '#type' => 'textarea',
    '#title' => t('Description of new Collation'),
  );

  $members = emicdora_get_members($object->id);
  $versionable_objects = array_keys($members, 'islandora:versionCModel');
  $transcriptions = array();
  foreach ($versionable_objects as $versionable_object) {
    $vo_members = emicdora_get_members($versionable_object);
    $transcriptions = array_merge($transcriptions, array_keys($vo_members, 'islandora:transcriptionCModel'));
  }
  $rows = array();

  foreach ($transcriptions as $transcription) {
    $transcription_object = islandora_object_load($transcription);
    $rows[$transcription] = array(
      'pid' => l($transcription, "islandora/object/$transcription"),
      'title' => l($transcription_object->label, "islandora/object/$transcription"),
    );
  }
  $header = array(
    'title' => array('data' => t('Transcription Title')),
    'pid' => array('data' => t('PID')),
  );
  $table_element = array(
    '#type' => 'tableselect',
    '#header' => $header,
    '#options' => $rows,
    '#empty' => t("There are no transcriptions associated with this Critical Edition."),
  );

  $form['pid'] = array(
    '#type' => 'hidden',
    '#value' => $object->id,
  );

  $form['intro'] = array(
    '#type' => 'markup',
    '#markup' => t("Choose transcriptions of @label to compare.", array('@label' => $object->label)),
  );
  $form['transcriptions'] = $table_element;
  $form['next'] = array(
    '#type' => 'submit',
    '#value' => t('Create Collation'),
  );
  $form['pid'] = array(
    '#type' => 'hidden',
    '#value' => $object->id,
  );

  return $form;
}

/**
 * Drupal Form Validation.
 *
 * @param array $form
 *   Drupal Form
 * @param array $form_state
 *   Drupal Form State
 */
function emicdora_mvd_form_validate($form, &$form_state) {
  module_load_include('inc', 'collation', 'includes/calliope');
  $critical_edition_object = islandora_object_load($form_state['values']['pid']);
  // Collation name cannot contain special characters but allow _ and space.
  // Note: when saved space gets translated to _.
  if (!preg_match('/^[a-z A-Z_0-9]+$/', $form_state['values']['mvd'])) {
    form_set_error('mvd', t('A collation name cannot contain any special characters.'));
  }
  $name = $form_state['values']['mvd'];
  if (emicdora_calliope_does_mvd_exist($name)) {
    form_set_error('mvd', t('A collation with the name @name is already created.', array('@name' => $name)));
  }
  // Check to make sure at least two files are selected for the Collation.
  if (count(array_filter($form_state['values']['transcriptions'])) < 2) {
    form_set_error('transcriptions', t('A minimum of two transcriptions are required to create a collation.'));
  }
  $pids = array_filter($form_state['values']['transcriptions']);
  emicdora_mvd_validate_transcripts($pids);
}

/**
 * Sumit handler for MVD form.
 *
 * @param array $form
 *   Drupal Form
 * @param array $form_state
 *   Drupal Form State
 */
function emicdora_mvd_form_submit(&$form, &$form_state) {
  module_load_include('inc', 'collation', 'includes/calliope');
  module_load_include('inc', 'islandora', 'includes/utilities');
  unset($_GET['destination']);
  $transcriptions = array_filter($form_state['values']['transcriptions']);
  $critical_edition_pid = $form_state['values']['pid'];
  $mvd_title = $form_state['values']['mvd'];
  $mvd_description = $form_state['values']['mvd_description'];
  $success = emicdora_calliope_create_mvd($critical_edition_pid, $mvd_title, $mvd_description, $transcriptions);
  if ($success) {
    $mvd_title = str_replace(' ', '_', $mvd_title);
    $form_state['redirect'] = array(
      "islandora/object/$critical_edition_pid/compare/$mvd_title",
      array('fragment' => "$mvd_title/$critical_edition_pid"),
    );
  }
}

/**
 * Handles all crud operations for MVDs.
 *
 * @param string $critical_edition_pid
 *   PID of Critical Edition
 * @param string $mvd_label
 *   Identifier for MVD
 * @param string $operation
 *   action to perform
 * @param bool $ui
 *   Whether the operation is being triggered through the Operations block or
 *   not.
 */
function emicdora_mvd_crud($critical_edition_pid, $mvd_label, $operation, $ui = FALSE) {
  module_load_include('inc', 'collation', 'includes/calliope');
  $query = array(
    'metadata.critical_edition' => $critical_edition_pid,
    'metadata.name' => $mvd_label,
  );
  $mvds = emicdora_calliope_find_mvd($query);
  if (empty($mvds)) {
    return;
  }
  $mvd = $mvds[0];
  $mvd_description = isset($mvd['metadata']['description']) ? $mvd['metadata']['description'] : t("No description");

  switch ($operation) {
    case 'refresh':
      foreach ($mvd['metadata']['resources'] as $transcription) {
        $resource_ids[] = $transcription['id'];
      }
      $filter = $mvd['metadata']['filter'];
      // Need to delete the files out of Calliope too.
      foreach ($resource_ids as $resource) {
        emicdora_calliope_delete_file($resource);
      }
      emicdora_calliope_create_mvd($critical_edition_pid, $mvd_label, $mvd_description, $resource_ids, $filter);
      if (!$ui) {
        drupal_goto("islandora/object/$critical_edition_pid/edit");
      }
      break;

    case 'bulk_delete':
      emicdora_calliope_delete_mvd($mvd['_id']);
      break;

    case 'delete':
      emicdora_calliope_delete_mvd($mvd['_id']);
      drupal_set_message(t("Collation successfully removed"));
      drupal_goto("islandora/object/$critical_edition_pid");
      break;

    case 'compare':
      drupal_goto("collationtools/compare", array('fragment' => "$mvd_label/$critical_edition_pid"));
      break;

    case 'apparatus':
      drupal_goto("collationtools/apparatus", array('fragment' => "$mvd_label/$critical_edition_pid"));
      break;

    case 'list':
      $cursor = emicdora_calliope_compare_callback($critical_edition_pid);
      $results = array();
      foreach ($cursor as $obj) {
        $results['results'][] = $obj['metadata'];
      }
      echo json_encode($results);
      break;

    default:
      break;
  }
}

/**
 * Confirm form to delete collations and refresh transcriptions through the UI.
 *
 * @param array $form
 *   An array representing a form within Drupal.
 * @param array $form_state
 *   An array containing the Drupal form state.
 * @param AbstractObject $critical_edition
 *   An AbstractObject representing an object within Fedora.
 * @param string $operation
 *   The operation taking place, either 'refresh' or 'delete'.
 * @param string $mvd_label
 *   The label of the MVD used when performing actions.
 * @param string $previous_view
 *   A string representing the path part the user was viewing previously.
 *
 * @return array
 *   The confirm form as prepared by Drupal.
 */
function emicdora_mvd_operation_confirm_form($form, &$form_state, AbstractObject $critical_edition, $operation, $mvd_label, $previous_view) {
  if ($operation == 'refresh') {
    $text = t('transcriptions which are linked to this collation?');
  }
  else {
    $text = t('this collation?');
  }
  $message = t('Are you sure you want to @operation @text', array(
    '@operation' => $operation,
    '@text' => $text,
  ));
  $path = array(
    'path' => "islandora/object/$critical_edition->id/$previous_view/$mvd_label",
    'fragment' => "$mvd_label/$critical_edition->id",
  );
  // The confirm_form uses $_GET['destination'] by default so to get the
  // cancel redirect to go to the proper destination it needs to be unset.
  if (isset($_GET['destination'])) {
    unset($_GET['destination']);
  }
  $form_state['previous_view'] = $previous_view;
  $form_state['critical_edition'] = $critical_edition->id;
  $form_state['operation'] = $operation;
  $form_state['mvd'] = $mvd_label;
  return confirm_form($form, $message, $path);
}

/**
 * Form validation to check the update transcripts on collation refresh.
 *
 * @param array $form
 *   Drupal Form
 * @param array $form_state
 *   Drupal Form State
 */
function emicdora_mvd_operation_confirm_form_validate($form, &$form_state) {
  $critical_edition = $form_state['critical_edition'];
  $mvd = $form_state['mvd'];
  $operation = $form_state['operation'];
  // Validate if the transcription is valid for generation a collation.
  if ($operation == 'refresh') {
    module_load_include('inc', 'collation', 'includes/calliope');
    $query = array(
      'metadata.critical_edition' => $critical_edition,
      'metadata.name' => $mvd,
    );
    $mvds = emicdora_calliope_find_mvd($query);
    if (empty($mvds)) {
      return;
    }
    $mvd = $mvds[0];

    foreach ($mvd['metadata']['resources'] as $transcription) {
      $transcription_pids[] = $transcription['id'];
    }
    emicdora_mvd_validate_transcripts($transcription_pids);
  }
}

/**
 * Submit handler for the MVD confirm form.
 *
 * @param array $form
 *   An array representing a form within Drupal.
 * @param array $form_state
 *   An array containing the Drupal form state.
 */
function emicdora_mvd_operation_confirm_form_submit($form, &$form_state) {
  $critical_edition = $form_state['critical_edition'];
  $mvd = $form_state['mvd'];
  $operation = $form_state['operation'];
  $previous_view = $form_state['previous_view'];
  emicdora_mvd_crud($critical_edition, $mvd, $operation, TRUE);

  // Want to override the redirect on refresh operation.
  if ($operation == 'refresh') {
    drupal_goto("islandora/object/$critical_edition/$previous_view/$mvd", array(
      'fragment' => "$mvd/$critical_edition",
    ));
  }
}
