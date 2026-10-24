---
assurance:
  id: t-6
  base: sha256:77872bd048770bdfee57f578f06ca93535dc21e662d8cf8cdd06f5dc21e6b8ba
---
# All three settings change reading appearance

> Exercise font size, width and background options, current values, and immediate appearance.

## Step 1

Open {{start_url}} in a browser and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}.

## Step 2 @verifies ac-8

In the editor's Aa Reading settings panel, traverse the font-size control from 14 to 24 px, then assert its displayed font values follow exactly 14, 16, 18, 20, 22, 24 px.

## Step 3 @verifies ac-9

In the same panel, traverse line width from Narrow through Full, then assert its options are exactly Narrow, Medium, Wide, Full.

## Step 4 @verifies ac-10

In the same panel, traverse the background control from 60% to 100%, then assert its displayed percentages follow exactly 60%, 70%, 80%, 90%, 100%.

## Step 5 @verifies ac-7, ac-11

In the same panel, choose 20 px font size, Wide line width, and 70% background, then assert the reading appearance reflects the newly chosen settings without a reload and each control displays its currently selected value.
