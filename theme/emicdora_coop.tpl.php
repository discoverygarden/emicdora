<?php
/**
 * @file
 * islandora-basic-collection.tpl.php
 */
?>
<div class="emicdora-coop">
  <div class="emicdora-add-to-coop">
    <div class="emicdora-add-to-coop-select">
      <label for="add-to-coop"><?php print t('Add to CO-OP'); ?></label>
      <select id="add-to-coop">
        <option value="none"><?php print t('Select...'); ?></option>
        <?php foreach ($add_source_links as $item): ?>
          <option value="<?php print $item['href']; ?>"><?php print $item['title']; ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <?php print $coop_icon?>
  </div>
  <p><?php print t('Welcome to the CO-OP. This is where all the source material for the Critical </br> Editions resides. We have grouped the content by various categories.'); ?></p>
  <?php print $browse_all_link; ?>
  <?php print $variables['title_table']; ?>
 <?php print $variables['collection_pager']; ?>
  <?php print $variables['author_table']; ?>
  <div class="clearfix"></div>
</div>
