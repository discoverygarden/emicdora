<?php

/**
 * @file
 * Reconfigures Calliope inputs.
 */

/**
 * Reconfigures stock Calliope json.
 *
 * @global url $base_url
 *
 * @param string $collation
 *   Collation name
 */
function emicdora_fix_calliope_inputs($collation) {
  global $base_url;
  $mvd_url = variable_get('mvd_server_url', $base_url) . variable_get('austese_server_prefix', '');
  $json = file_get_contents("$mvd_url/json/list/$collation");
  $results = json_decode($json, TRUE);
  foreach ($results['versions'] as &$version) {
    $version['longname'] = str_replace('/Base/', '', $version['version']);
  }
  echo json_encode($results);
}