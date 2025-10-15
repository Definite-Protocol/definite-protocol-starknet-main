use owo_colors::{OwoColorize, Rgb, Style};
use indicatif::ProgressStyle;

/// Pastel red/pink color theme for the CLI
pub struct Theme;

// Define custom pastel red/pink colors
pub const PRIMARY: Rgb = Rgb(220, 120, 140);      // Soft rose
pub const SECONDARY: Rgb = Rgb(200, 100, 120);    // Deeper rose
pub const SUCCESS: Rgb = Rgb(180, 200, 140);      // Soft green with pink tint
pub const WARNING: Rgb = Rgb(240, 180, 120);      // Warm peach
pub const ERROR: Rgb = Rgb(240, 120, 120);        // Soft red
pub const INFO: Rgb = Rgb(160, 140, 180);         // Lavender
pub const ACCENT: Rgb = Rgb(255, 182, 193);       // Light pink
pub const MUTED: Rgb = Rgb(160, 120, 130);        // Muted rose

impl Theme {
    pub fn init() {
        // Initialize terminal colors and settings
    }
    
    pub fn primary_style() -> Style {
        Style::new().color(PRIMARY).bold()
    }
    
    pub fn secondary_style() -> Style {
        Style::new().color(SECONDARY)
    }
    
    pub fn success_style() -> Style {
        Style::new().color(SUCCESS).bold()
    }
    
    pub fn warning_style() -> Style {
        Style::new().color(WARNING).bold()
    }
    
    pub fn error_style() -> Style {
        Style::new().color(ERROR).bold()
    }
    
    pub fn info_style() -> Style {
        Style::new().color(INFO)
    }
    
    pub fn accent_style() -> Style {
        Style::new().color(ACCENT).bold()
    }
    
    pub fn muted_style() -> Style {
        Style::new().color(MUTED)
    }
    
    pub fn table_header_style() -> Style {
        Style::new().color(SECONDARY).bold().on_color(Rgb(40, 30, 35))
    }
    
    pub fn highlight_style() -> Style {
        Style::new().color(ACCENT).bold().on_color(Rgb(50, 40, 45))
    }
}

/// Create a progress bar style with the theme colors
pub fn progress_style() -> ProgressStyle {
    ProgressStyle::default_bar()
        .template("{spinner:.pink} [{elapsed_precise}] [{bar:40.pink/magenta}] {pos:>7}/{len:7} {msg}")
        .unwrap()
        .progress_chars("█▉▊▋▌▍▎▏  ")
}

/// Create a spinner style with the theme colors
pub fn spinner_style() -> ProgressStyle {
    ProgressStyle::default_spinner()
        .template("{spinner:.pink} {msg}")
        .unwrap()
        .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
}
