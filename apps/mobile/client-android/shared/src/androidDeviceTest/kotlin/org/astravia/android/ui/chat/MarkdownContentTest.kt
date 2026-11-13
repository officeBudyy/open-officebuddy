package org.astravia.android.ui.chat

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.test.Test
import kotlin.test.assertTrue
import org.astravia.android.app.ThemeMode
import org.astravia.android.ui.theme.AstraviaTheme
import org.junit.Rule
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MarkdownContentTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun tableCellsWrapInsteadOfClippingToOneLine() {
        val longCell = "这是一段必须完整换行显示而不能被省略号截断的表格内容"
        composeRule.setContent {
            AstraviaTheme(ThemeMode.Light) {
                MarkdownContent("| 内容 |\n| --- |\n| $longCell |", Modifier.width(180.dp))
            }
        }

        val bounds = composeRule.onNodeWithText(longCell).getUnclippedBoundsInRoot()
        assertTrue(bounds.height > 40.dp, "table cell should occupy multiple lines, but was ${bounds.height}")
    }
}
