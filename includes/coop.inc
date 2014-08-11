<?php
/**
 * @file
 * Defines all the funciton calls involving the coop cmodel.
 */

/**
 * Page callback to view COOP objects in a critical edition.
 *
 * @param unknown $islandora_object
 *   The Critical Edition object to find source objects for.
 */
function emicdora_coop($islandora_object) {
  module_load_include('inc', 'emicdora', 'includes/utilities');
  $source_content_models = emicdora_source_content_models();
  $add_source_links = array();
  foreach ($source_content_models as $content_model => $label) {
    $add_source_links[] = array(
      'title' => t('Add @label', array('@label' => $label)),
      'href' => "workbench/add/$content_model",
    );
  }
  return theme('emicdora_coop_group_page', array(
    'islandora_object' => $islandora_object,
    'add_list' => $add_source_links,
    'source_collection' => url("islandora/object/" . EMICDORA_SOURCE_COLLECTION),
    )
  );
}